import { Hono } from 'hono'


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
const privilegedMethods = [ 'PUT', 'PATCH', 'DELETE']
const app = new Hono<{Bindings: Bindings, Variables: Variables}>()

// enable middleware for methods besides POST/GET
app.on(privilegedMethods, '/', (c, next) => {
  const jwtmw = verifyRsaJwt({
    jwksUri: c.env.JWKS_URI,
    kvStore: c.env.PUBLIC_JWK_CACHE_KV,
    payloadValidator: ({payload, c}) => { /* Validate the payload, throw an error if invalid */ },
  })
  return jwtmw(c, next)
})


// list users
app.get('/', async c => {
    const { payload, good } = await sanitycheckAUD(c)
    if (!good) {
        return c.json({ err: "AUD fail" }, 500)
    }

    // Retrieve the users in the Members table.
    try {
        const stmt = c.env.DB.prepare('SELECT NAME,EMAIL,ROLE,GUID FROM members WHERE DELETED IS NULL')
        const { results, success } = await stmt.all()
        if (success) {
            if (results && results.length >= 1) {
                return c.json({ ...results })
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
    const { payload, good } = await sanitycheckAUD(c)
    if (!good) {
        return c.json({ err: "AUD fail" }, 500)
    }

    const { guid } = c.req.param()
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



// create user
app.post('/', async c => {
    const { payload, good } = await sanitycheckAUD(c)
    if (!good) {
        return c.json({ err: "AUD fail" }, 500)
    }

    // TODO Two flows, superuser is creating or visitor is registering.
    // BUT if we go with a pending approval queue, create should never be done by person.

	////const { name, email, role } = await c.req.json<Member>()
	const { name, email } = await c.req.json<Member>()

	if (!name) return c.text('Missing name value for new user')
	////if (!email) return c.text('Missing email value for new user')
	////if (!role) return c.text('Missing role value for new user')

    try {
////const db = drizzle(c.env.DB)
////await db.insert(members).values({ name: name, email: email, role: role })
        // TODO insert requires email to be unique
        // TODO generate GUID
        const stmt = c.env.DB.prepare('INSERT INTO members (NAME, EMAIL, ROLE) VALUES (?1, ?2, ?3)').bind(name, email, 'PENDING')
        await stmt.run()
    } catch {
        c.status(500)
        return c.text('Something went wrong')
    }

    c.status(201)
    return c.text('Created')
})

// nextjs initiates confirm of identity (using CF Access JWT)
app.post('/identify', async c => {
    const { payload, good } = await sanitycheckAUD(c)
    if (!good) {
        return c.json({ err: "AUD fail" }, 500)
    }

    const member = await memberByGuid(c, payload.sub)
    if (!member) {
        return c.json({ err: "GUID not found" }, 500)
    }

    return c.json({ ...member })
/******************************
    // With the subject ID in the token, look up the visitor in the Members table.
    try {
        const stmt = c.env.DB.prepare('SELECT * FROM members WHERE GUID = ?1 AND DELETED IS NULL').bind(payload.sub)
        const { results, success } = await stmt.all()
        if (success) {
            if (results && results.length >= 1) {
                const row = results[0]
                const { name, email, role } = row
                const member = {name: name, role: role, email: email, refid: payload.sub}
                return c.json({ ...member })
             } else {
                return c.json({ err: "Zero members with GUID" }, 500)
             }
        }
        return c.json({ err: "Member by GUID failed" }, 500)
    } catch(e) {
        return c.json({ err: e.message }, 500)
    }************************/
})

// helper for the POST methods (may be collapsed into middleware after we learn to use the policyValidator)
async function sanitycheckAUD(c) {
    // POST/GET endpoints for the nextjs consumer.
    // We still expect visitors to sign-in via Cloudflare Access.
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
// lookup visitor in the Member table
async function memberByGuid(c, guid) {
    try {
        const stmt = c.env.DB.prepare('SELECT * FROM members WHERE GUID = ?1 AND DELETED IS NULL').bind(guid)
        const { results, success } = await stmt.all()
        if (!success) return null
        if (!results || results.length ==0) return null

        const row = results[0]
        const { name, email, role } = row
        return {name: name, role: role, email: email, refid: guid}
    } catch {
        // TODO better error handling
        return null
    }
}

export default app
