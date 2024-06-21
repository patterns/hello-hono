import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import type { JwtVariables } from 'hono/jwt'

////import { drizzle } from 'drizzle-orm/d1'
////import { eq } from 'drizzle-orm'

import {
  getJwks,
  useKVStore,
  verify,
  VerifyRsaJwtEnv,
  VerificationResult,
  verifyRsaJwt,
  getPayloadFromContext,
  createGetCookieByKey,
} from 'verify-rsa-jwt-cloudflare-worker'

type Variables = VerifyRsaJwtEnv

// enable middleware for JWT
const privilegedMethods = ['GET', 'PUT', 'PATCH', 'DELETE']
type Variables = JwtVariables
const app = new Hono<{Bindings: Bindings, Variables: Variables}>()
app.on(privilegedMethods, '/', (c, next) => {
  const jwtmw = jwt({ secret: c.env.JWT_SECRET, cookie: 'authorization' })
  return jwtmw(c, next)
})


// list users
app.get('/', async c => {
/*
	const db = drizzle(c.env.DB)
	const result = await db.select({
	    firstName: members.name,
	    lastName: members.role,
	    username: members.email,
	    id: members.guid,
	}).from(members)*/


	// Retrieve the users in the Members table.
	try {
		const stmt = c.env.DB.prepare('SELECT NAME,EMAIL,ROLE,GUID FROM members WHERE DELETED IS NULL')
		const { results, success } = await stmt.all()
		if (success) {
			if (results && results.length >= 1) {
				const users = results
				return c.json({ ...users })
			} else {
				return c.json({ err: "Zero members" }, 500)
			}
		}
		return c.json({ err: "Member list failed" }, 500)
	} catch(e) {
		return c.json({ err: e.message }, 500)
	}
})

// user by id
app.get('/:guid', async c => {
	const { guid } = c.req.param()
/*
	const db = drizzle(c.env.DB)
	const result = await db.select().from(members).where(eq(members.guid, guid))*/


	// With the GUID, look up the user in the Members table.
	try {
		const stmt = c.env.DB.prepare('SELECT * FROM members WHERE GUID = ?1 ').bind(guid)
		const { results, success } = await stmt.all()
		if (success) {
			if (results && results.length >= 1) {
				const row = results[0]
			        const user = {name: row.name, role: row.role, email: row.email, refid: row.guid}
				return c.json({ ...user })
			} else {
				return c.json({ err: "Zero members with GUID" }, 500)
			}
		}
		return c.json({ err: "Member by GUID failed" }, 500)
	} catch(e) {
		return c.json({ err: e.message }, 500)
	}

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

// ***POST*** methods (as general rule) we want to enforce CF Access JWT with more granularity

// create user
app.post('/', async c => {
	const { payload, good } = await sanitycheckAUD(c)
	if (!good) {
		return c.json({ err: "AUD fail" }, 500)
	}


	// TODO Two flows, superuser is creating or visitor is registering.
	// BUT if we go with a pending approval queue, create should never be done by person.

	const { name, email, role } = await c.req.json<Member>()

	if (!name) return c.text('Missing name value for new user')
	if (!email) return c.text('Missing email value for new user')
	if (!role) return c.text('Missing role value for new user')

	try {
		////const db = drizzle(c.env.DB)
		////await db.insert(members).values({ name: name, email: email, role: role })
		// TODO insert requires email/guid to be unique
		const stmt = c.env.DB.prepare('INSERT INTO members (NAME, EMAIL, ROLE) VALUES (?1, ?2, ?3)').bind(name, email, role)
		await stmt.run()
	} catch {
		c.status(500)
		return c.text('Something went wrong')
	}

	c.status(201)
	return c.text('Created')
})

// nextjs initiates confirm of identity (with CF Access JWT)
app.post('/identify', async c => {
	const { payload, good } = await sanitycheckAUD(c)
	if (!good) {
		return c.json({ err: "AUD fail" }, 500)
	}


	// With the subject ID in the token, look up the user in the Members table.
	try {
		const stmt = c.env.DB.prepare('SELECT * FROM members WHERE GUID = ?1 AND DELETED IS NULL').bind(payload.sub)
		const { results, success } = await stmt.all()
		if (success) {
			if (results && results.length >= 1) {
				const row = results[0]
				const { name, email, role } = row
			        const user = {name: name, role: role, email: email, refid: payload.sub}

	// create auth cookie between nextjs and us/api (12 hour ttl)
	const cookiedata = {
	  sub: payload.sub,
	  role: role,
	  exp: Math.floor(Date.now() / 1000) + 60 * 5*12 *12,
	}
	const secret = c.env.JWT_SECRET
	const token = await sign(cookiedata, secret)

				setCookie(c, 'authorization', token)
				return c.json({ ...user })
			} else {
				return c.json({ err: "Zero members with GUID" }, 500)
			}
		}
		return c.json({ err: "Member by GUID failed" }, 500)
	} catch(e) {
		return c.json({ err: e.message }, 500)
	}
})

// helper for the POST methods (may be collapsed into middleware after we learn to use the policyValidator)
async function sanitycheckAUD(c) {
	// POST endpoints for initial contact by the nextjs consumer.
	// We still expect visitors to sign-in via Cloudflare Access (e.g., via registration flow).
	// Consider multiple AUDs, e.g., staging and prod

	const token = c.req.header('Cf-Access-Jwt-Assertion')
	const jwks = await getJwks(c.env.JWKS_URI, useKVStore(c.env.VERIFY_RSA_JWT))
	const { payload } = await verify(token, jwks)

	// Do validation on the payload fields.

	const aud = payload.aud
	if (!aud || aud.length == 0 || aud[0] != c.env.POLICY_AUD) {
		return { payload: payload, good: false }
	}

	return { payload: payload, good: true }
}


export default app
