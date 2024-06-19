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
  VerificationResult,
  verifyRsaJwt,
  getPayloadFromContext,
  createGetCookieByKey,
} from 'verify-rsa-jwt-cloudflare-worker'

import { members } from './schema'
type Variables = VerifyRsaJwtEnv
const privilegedMethods = ['GET', 'PUT', 'PATCH', 'DELETE']
/*
interface AppTokenPayload {
  aud: string[]
  email: string
  exp: Number
  iat: Number
  nbf: Number
  iss: string
  type: string
  sub: string
  country: string
}*/

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

// expected by nextjs proto
app.post('/identify', async c => {
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
	const db = drizzle(c.env.DB)
	////const result = await db.select().from(members).where(eq(members.guid, payload.sub))
	const result = await db.query.members.findFirst({
	  where: (members, {eq}) => eq(members.guid, payload.sub),
	})
	const { name, email, role, guid } = result
/*
	const newpl = {
	  sub: guid,
	  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Token expires in 24 hours
	}
	const secret = c.env.JWT_SECRET
	const deprecateBearer = await sign(newpl, secret)
        const user = {firstName: name, lastName: role, username: email, id: guid}
	return c.json({ ...user, token })
*/
        const user = {name: name, role: role, email: payload.email, refid: payload.sub}
	return c.json({ ...user })
})
// expected by nextjs proto
app.post('/register', async c => {
	c.status(501)
	return c.text('TODO user register goes here')
})

export default app
