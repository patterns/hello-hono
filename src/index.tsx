import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { renderer } from './renderer'

interface User {
      name: string
      email: string
      role: string
}

type Bindings = {
      DB: D1Database
}

const app = new Hono<{Bindings: Bindings}>()
app.use(renderer)
app.use('/api/*', cors())

app.get('/api/users/:slug', async c => {
        //TODO is it safe to expose the ID?
	const { slug } = c.req.param();
	const { results } = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`)
		.bind(slug)
		.all();
	return c.json(results)
})

app.post('/api/users', async c => {
	const { name, email, role } = await c.req.json<User>();

	if (!name) return c.text('Missing name value for new user');
	if (!email) return c.text('Missing email value for new user');
	if (!role) return c.text('Missing role value for new user');

        //TODO fields are separate tables maybe need sproc
	const { success } = await c.env.DB.prepare(
		`INSERT into users (name, email, role) VALUES (?, ?, ?)`
	)
		.bind(name, email, role)
		.run();

	if (success) {
		c.status(201);
		return c.text('Created');
	} else {
		c.status(500);
		return c.text('Something went wrong');
	}
})

app.onError((err, c) => {
	console.error(`${err}`);
	return c.text(err.toString());
})

app.notFound(c => c.text('Not found', 404));

app.get('/', (c) => {
  return c.render(<p>Hello! This is a placeholder.</p>)
})

export default app
