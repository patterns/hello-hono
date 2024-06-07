import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bearerAuth } from 'hono/bearer-auth'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { renderer } from './renderer'
import { members } from './schema'

const privilegedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const app = new Hono<{Bindings: Bindings}>()
app.use(renderer)
app.use('/api/*', cors())

// start by requiring header (Authorization: Bearer)
app.on(privilegedMethods, '/api/*', async (c, next) => {
  // Single valid privileged token
  const bearer = bearerAuth({ token: c.env.BEARER_TOKEN })
  return bearer(c, next)
})

app.get('/api/users', async c => {
	const db = drizzle(c.env.DB)
	const result = await db.select({
	    name: members.name,
	    role: members.role,
	    guid: members.guid,
	}).from(members)
	return c.json(result)
})

app.get('/api/users/:guid', async c => {
	const { guid } = c.req.param()
	const db = drizzle(c.env.DB)
	const result = await db.select().from(members).where(eq(members.guid, guid))
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
  return c.html(
    <html>
      <head>
        {import.meta.env.PROD ? (
          <script type='module' src='/static/client.js'></script>
        ) : (
          <script type='module' src='/src/client.ts'></script>
        )}
      </head>
      <body>


<h1>Welcome to PLACEHOLDER</h1>
<div id="firebaseui-auth-container"></div>
<div id="loader">Loading...</div>
      </body>
    </html>
  )
})

export default app
