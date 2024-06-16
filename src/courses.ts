import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import type { JwtVariables } from 'hono/jwt'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'

import { courses } from './schema'

type Variables = JwtVariables
const privilegedMethods = ['GET', 'PUT', 'PATCH', 'DELETE']
const app = new Hono<{Bindings: Bindings, Variables: Variables}>()

// require token except on POST
app.on(privilegedMethods, '/', (c, next) => {
  const jwtmw = jwt({ secret: c.env.JWT_SECRET })
  return jwtmw(c, next)
})

// list courses
app.get('/', async c => {
	const db = drizzle(c.env.DB)
	const result = await db.select().from(courses)
	return c.json(result)
})

// course by id
app.get('/:guid', async c => {
	const { guid } = c.req.param()
	const db = drizzle(c.env.DB)
	const result = await db.select().from(courses).where(eq(courses.guid, guid))
	return c.json(result)
})

// course overwrite
app.put('/:guid', async c => {
	const { guid } = c.req.param()
	c.status(501)
	return c.text('TODO course overwrite goes here')
})

// course delete
app.delete('/:guid', async c => {
	const { guid } = c.req.param()
	c.status(501)
	return c.text('TODO course delete goes here')
})

// create course
app.put('/', async c => {
	const { title, description, category, published, url } = await c.req.json<Course>()

	if (!title) return c.text('Missing title value for new course')
	if (!description) return c.text('Missing description value for new course')
	if (!category) return c.text('Missing category value for new course')
	if (!published) return c.text('Missing published value for new course')

	//TODO check role is instructor
	try {
		const db = drizzle(c.env.DB)
		await db.insert(courses).values({ title: title, description: description, category: category, published: published, url: url })
	} catch {
		c.status(500)
		return c.text('Something went wrong')
	}

	c.status(201)
	return c.text('Created')
})


export default app
