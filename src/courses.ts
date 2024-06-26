import { Hono } from 'hono'
////import { jwt, sign } from 'hono/jwt'
////import type { JwtVariables } from 'hono/jwt'
////import { drizzle } from 'drizzle-orm/d1'
////import { eq } from 'drizzle-orm'

import {
  verifyRsaJwt,
  getPayloadFromContext,
  createGetCookieByKey,
} from 'verify-rsa-jwt-cloudflare-worker'


const privilegedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const app = new Hono<{Bindings: Bindings}>()

// CF Access JWT
app.on(privilegedMethods, '/', (c, next) => {
  const middleware = verifyRsaJwt({
    jwksUri: c.env.JWKS_URI,
    kvstore: c.env.VERIFY_RSA_JWT,
    payloadValidator: ({payload, c}) => { /* chk role/AUD, else throw err */ },
  })
  return middleware(c, next)
})
/****************
////import { courses } from './schema'
type Variables = JwtVariables
const app = new Hono<{Bindings: Bindings, Variables: Variables}>()
// require token except on POST
app.on(privilegedMethods, '/', (c, next) => {
  const jwtmw = jwt({ secret: c.env.JWT_SECRET })
  return jwtmw(c, next)
})
***************/

// list courses
app.get('/', async c => {
////const db = drizzle(c.env.DB)
////const result = await db.select().from(courses)
////return c.json(result)

    // Retrieve the collection in the Courses table.
    try {
        const stmt = c.env.DB.prepare('SELECT TITLE,DESCRIPTION,CATEGORY,URL,GUID FROM courses WHERE PUBLISHED IS NOT NULL')

        const { results, success } = await stmt.all()
        if (success) {
            if (results && results.length >= 1) {
                return c.json({ ...results })
            } else {
                return c.json({ err: "Zero members" }, 500)
            }
        }
        return c.json({ err: "Course list failed" }, 500)
    } catch(e) {
        return c.json({ err: e.message }, 500)
    }
})

// course by id
app.get('/:guid', async c => {
    const { guid } = c.req.param()
////const db = drizzle(c.env.DB)
////const result = await db.select().from(courses).where(eq(courses.guid, guid))
////return c.json(result)
    try {
        const stmt = c.env.DB.prepare('SELECT * FROM courses WHERE GUID = ?1').bind(guid)

        const { results, success } = await stmt.all()
        if (success) {
            if (results && results.length >= 1) {
                return c.json({ ...results })
            } else {
                return c.json({ err: "Zero courses with GUID" }, 500)
            }
        }
        return c.json({ err: "Courses by GUID failed" }, 500)
    } catch(e) {
        return c.json({ err: e.message }, 500)
    }
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
app.post('/', async c => {
    const { title, description, category, url } = await c.req.json<Course>()

    if (!title) return c.text('Missing title value for new course')
    if (!description) return c.text('Missing description value for new course')
    if (!category) return c.text('Missing category value for new course')

    //TODO check role is instructor
    //     generate GUID
    try {
////const db = drizzle(c.env.DB)
////await db.insert(courses).values({ title: title, description: description, category: category, published: published, url: url })

        // TODO insert requires email/guid to be unique
        const stmt = c.env.DB.prepare('INSERT INTO members (TITLE, DESCRIPTION, CATEGORY, URL) VALUES (?1, ?2, ?3, ?4)').bind(title, description, category, url)

        await stmt.run()

    } catch {
        c.status(500)
        return c.text('Create course fail')
    }

    c.status(201)
    return c.text('Created')
})


export default app
