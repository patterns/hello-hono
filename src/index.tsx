import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { drizzle } from 'drizzle-orm/d1'
import { renderer } from './renderer'
import { members } from './schema'


const app = new Hono<{Bindings: Bindings}>()
app.use(renderer)
app.use('/api/*', cors())

app.get('/api/users/:slug', async c => {
	const { slug } = c.req.param()
	const db = drizzle(c.env.DB)
	const result = await db.query.members.findMany()
/*
.findFirst({
  where: (member, { eq }) => eq(member.guid, slug),
  columns: { name: true, email: true, role: true },
})
*/
	return c.json(result)
})

app.post('/api/users', async c => {
	const { name, email, role } = await c.req.json<Member>()

	if (!name) return c.text('Missing name value for new user')
	if (!email) return c.text('Missing email value for new user')
	if (!role) return c.text('Missing role value for new user')

	try {
		const db = drizzle(c.env.DB)
		await db.insert(members).values({ name: name, email: email, role: role })
	} catch {
		c.status(500)
		return c.text('Something went wrong')
	}

	c.status(201)
	return c.text('Created')
})

app.onError((err, c) => {
	console.error(`${err}`)
	return c.text(err.toString())
})

app.notFound(c => c.text('Not found', 404))

app.get('/', (c) => {
      return c.render(<p>Hello! This is a placeholder.</p>)
})

export default app
