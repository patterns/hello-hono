import { Hono } from 'hono'
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
import * as d1 from './d1'

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
    const { payload, good, token } = await sanitycheckAUD(c)
    if (!good) {
        return c.json({ err: "AUD fail" }, 500)
    }

    // Two flows, superuser is creating or visitor is registering.
    // BUT if we go with a pending approval queue, create should never be done by person.

    const member = await d1.memberByGuid(c, payload.sub)
    if (member) {
        // is there a pending membership in the queue?
        // TODO need to avoid a DELETED member re-registering?
        return c.json({ err: "Existing membership fail" }, 500)
    }

    // DEBUG fetch extra fields
    ////const ident = userIdentity(token)
    const name = guessName(payload.email)

    const success = d1.createMember(c, name, payload.email, payload.sub)
    if (success) return c.json(ident, 201)
    return c.json({ err: "Members DML statement run fail" }, 500)
})

// nextjs initiates confirm of identity (using CF Access JWT)
app.post('/identify', async c => {
    const { payload, good } = await sanitycheckAUD(c)
    if (!good) {
        return c.json({ err: "AUD fail" }, 500)
    }

    // With the subject ID in the token, look up the visitor in the Members table.
    const member = await d1.memberByGuid(c, payload.sub)
    if (!member) {
        return c.json({ err: "GUID not found" }, 500)
    }

    return c.json({ ...member })
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

    return { payload: payload, good: true, token: token }
}

// CF provides extra identity fields separately
async function userIdentity(token) {
    const value = `CF_Authorization=${token}`

    try {
        const res = await fetch(c.env.USER_IDENTIY_URL, {
                headers: { "cookie": value },
        })

        const data = await res.json()
        return data
    } catch (error) {
        console.log('CF user ident:', error)
        return { error: error }
    }
}

// a best guess of the name using the email
function guessName(email) {
    // easiest shorcut is to use the text leftmost of @ in the email

    const index = email.indexOf('@')
    if (index > -1) {
        const sub = email.slice(0, index)
        return sub.trim()
    }

    return email
}

export default app
