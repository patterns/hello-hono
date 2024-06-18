import { Hono } from 'hono'
////import { jwt, sign } from 'hono/jwt'
////import type { JwtVariables } from 'hono/jwt'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'

import {
  getJwks,
  useKVStore,
  verify,
  VerifyRsaJwtEnv,
  verifyRsaJwt,
  getPayloadFromContext,
  createGetCookieByKey,
} from 'verify-rsa-jwt-cloudflare-worker'

import { members } from './schema'
type Variables = VerifyRsaJwtEnv
const privilegedMethods = ['GET', 'PUT', 'PATCH', 'DELETE']

const app = new Hono<{Bindings: Bindings, Variables: Variables}>()
app.on(privilegedMethods, '/', (c, next) => {
  const verifymw = verifyRsaJwt({
    jwksUri: c.env.JWKS_URI,
    kvstore: c.env.VERIFY_RSA_JWT,
    payloadValidator: ({payload, c}) => { /* chk role/AUD, else throw err */ },
  })
  return verifymw(c, next)
})
/*
////type Variables = JwtVariables
////const app = new Hono<{Bindings: Bindings, Variables: Variables}>()
// require token except on POST
app.on(privilegedMethods, '/', (c, next) => {
  const jwtmw = jwt({ secret: c.env.JWT_SECRET })
  return jwtmw(c, next)
})
*/

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

// TODO nextjs consumer will send JWT header, then we don't need user/pw fields
// expected by nextjs proto
app.post('/authenticate', async c => {
	const token = c.req.header('Cf-Access-Jwt-Assertion')
	const jwks = await getJwks(c.env.JWKS_URI, useKVStore(c.env.VERIFY_RSA_JWT));
	const { ztpl } = await verify(token, jwks);
	if (ztpl.aud !== c.env.POLICY_AUD) {
		c.status(500)
		return c.json({})
	}
	// TODO get ztpl.email, and register (default role:student) if not exists

	const { username } = await c.req.json()
	const db = drizzle(c.env.DB)
	const result = await db.select().from(members).where(eq(members.email, username))
	const { name, email, role, guid } = result
	const payload = {
	  sub: guid,
	  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Token expires in 24 hours
	}
	const secret = c.env.JWT_SECRET
	const deprecateBearer = await sign(payload, secret)
        const user = {firstName: name, lastName: role, username: email, id: guid}
	return c.json({ ...user, token })
})
// expected by nextjs proto
app.post('/register', async c => {
	c.status(501)
	return c.text('TODO user register goes here')
})

export default app
