import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import type { JwtVariables } from 'hono/jwt'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'

import { members } from './schema'

type Variables = JwtVariables
const privilegedMethods = ['GET', 'PUT', 'PATCH', 'DELETE']
const app = new Hono<{Bindings: Bindings, Variables: Variables}>()

// require token except on POST
app.on(privilegedMethods, '/', (c, next) => {
  const jwtmw = jwt({ secret: c.env.JWT_SECRET })
  return jwtmw(c, next)
})

// list users
app.get('/', async c => {
	const db = drizzle(c.env.DB)
	const result = await db.select({
	    firstName: members.name,
	    lastName: members.role,
	    username: members.email,
	    id: members.guid,
	}).from(members)
	return c.json(result)
})

// user by id
app.get('/:guid', async c => {
	const { guid } = c.req.param()
	const db = drizzle(c.env.DB)
	const result = await db.select().from(members).where(eq(members.guid, guid))
	return c.json(result)
})

// user overwrite
app.put('/:guid', async c => {
	const { guid } = c.req.param()
	c.status(501)
	return c.text('TODO user overwrite goes here')
})

// user delete
app.delete('/:guid', async c => {
	const { guid } = c.req.param()
	c.status(501)
	return c.text('TODO user delete goes here')
})

// create user (a.k.a. "register")
app.put('/', async c => {
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

// expected by nextjs proto
app.post('/authenticate', async c => {
	const { username } = await c.req.json()
	const db = drizzle(c.env.DB)
	const result = await db.select().from(members).where(eq(members.email, username))
	const { name, email, role, guid } = result
	const payload = {
	  sub: guid,
	  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Token expires in 24 hours
	}
	const secret = c.env.JWT_SECRET
	const token = await sign(payload, secret)
        const user = {firstName: name, lastName: role, username: email, id: guid}
	return c.json({ ...user, token })
})
// expected by nextjs proto
app.post('/register', async c => {
	c.status(501)
	return c.text('TODO user register goes here')
})

export default app