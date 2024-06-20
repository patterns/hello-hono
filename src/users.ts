import { Hono } from 'hono'

import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'

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

import { members } from './schema'
type Variables = VerifyRsaJwtEnv
const privilegedMethods = ['GET', 'PUT', 'POST', 'DELETE']

const app = new Hono<{Bindings: Bindings, Variables: Variables}>()

// enable middleware for CF Access JWT
app.on(privilegedMethods, '/', (c, next) => {
	// TODO for updates, payloadValidator needs to enforce target is the owner (or superuser)

	const verifymw = verifyRsaJwt({
		jwksUri: c.env.JWKS_URI,
		kvstore: c.env.VERIFY_RSA_JWT,
		payloadValidator: ({payload, c}) => { /* chk role/AUD, else throw err */ },
	})
	return verifymw(c, next)
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

// create user
app.post('/', async c => {
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

// nextjs initiates confirm of identity by CF Access JWT
app.patch('/identify', async c => {
	// The identify endpoint is not guarded by the middleware in order for a initial contact by the nextjs consumer.
	// We still expect visitors to sign-in via Cloudflare Access (e.g., via registration flow).

	const token = c.req.header('Cf-Access-Jwt-Assertion')
	const jwks = await getJwks(c.env.JWKS_URI, useKVStore(c.env.VERIFY_RSA_JWT))
	const { payload } = await verify(token, jwks)
/* DEBUG skip aud check for now
	if (payload.aud[0] != c.env.POLICY_AUD) {
		c.status(500)
		return c.json({})
	}
*/

	// TODO ? and register (default role:student) if not exists
	try {
		const stmt = c.env.DB.prepare('SELECT * FROM members WHERE GUID = ?1 AND DELETED IS NULL').bind(payload.sub)
		const { results, success } = await stmt.all()
		if (success) {
			if (results && results.length >= 1) {
				const row = results[0]
				const { name, email, role, guid } = row
			        const user = {name: name, role: role, email: email, refid: payload.sub}
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


export default app
