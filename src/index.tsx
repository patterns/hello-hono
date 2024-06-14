import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { html } from 'hono/html'
import { bearerAuth } from 'hono/bearer-auth'
import { getCookie, setCookie } from 'hono/cookie'
import {
  VerifySessionCookieFirebaseAuthConfig,
  VerifyFirebaseAuthEnv,
  verifySessionCookieFirebaseAuth,
  getFirebaseToken,
} from '@hono/firebase-auth'
import {
  AdminAuthApiClient,
  ServiceAccountCredential,
  WorkersKVStoreSingle,
} from 'firebase-auth-cloudflare-workers'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { renderer } from './renderer'
import { members } from './schema'

const privilegedMethods = ['GET', 'PUT', 'PATCH', 'DELETE']


const app = new Hono<{Bindings: Bindings}>()
app.use(renderer)
app.use('/api/*', cors())


// start by requiring header (Authorization: Bearer)
app.on(privilegedMethods, '/api/users', async (c, next) => {
  // Single valid privileged token
  const bearer = bearerAuth({ token: c.env.BEARER_TOKEN })
  return bearer(c, next)
})


// list users
app.get('/api/users', async c => {
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
app.get('/api/users/:guid', async c => {
	const { guid } = c.req.param()
	const db = drizzle(c.env.DB)
	const result = await db.select().from(members).where(eq(members.guid, guid))
	return c.json(result)
})

// user update
app.put('/api/users/:guid', async c => {
	const { guid } = c.req.param()
	c.status(501)
	return c.text('TODO user update goes here')
})

// user delete
app.delete('/api/users/:guid', async c => {
	const { guid } = c.req.param()
	c.status(501)
	return c.text('TODO user delete goes here')
})

// create user (a.k.a. "register")
app.put('/api/users', async c => {
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
app.post('/api/users/authenticate', async c => {
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
app.post('/api/users/register', async c => {
	c.status(501)
	return c.text('TODO user register goes here')
})


// admin-panel (skeleton); using prebuild firebase widget (TODO refactor away the hono/firebase-auth if we don't utilize kv/sessions)
app.get('/login', csrf(), async c => {
  const fbaKey = c.env.FIREBASE_API_KEY
  const fbaDomain = c.env.FIREBASE_AUTH_DOMAIN
  const fbaProject = c.env.FIREBASE_PROJECT_ID
  const fbaBucket = c.env.FIREBASE_STORAGE_BUCKET
  const content = await html`<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>Sample FirebaseUI</title>
    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script>
    const fba = firebase.initializeApp({
          apiKey: '${fbaKey}',
          authDomain: '${fbaDomain}',
          projectId: '${fbaProject}',
          storageBucket: '${fbaBucket}',
    })
</script>
    <script src="https://www.gstatic.com/firebasejs/ui/6.1.0/firebase-ui-auth.js"></script>
    <link type="text/css" rel="stylesheet" href="https://www.gstatic.com/firebasejs/ui/6.1.0/firebase-ui-auth.css" />
  <script type="text/javascript">
// Initialize the FirebaseUI Widget using Firebase.
var ui = new firebaseui.auth.AuthUI(firebase.auth())
var uiConfig = {
  callbacks: {
    signInSuccessWithAuthResult: function(authResult, redirectUrl) {
      // User successfully signed in.
      // Return type determines whether we continue the redirect automatically
      // or whether we leave that to developer to handle.
      return true;
    },
    uiShown: function() {
      // The widget is rendered.
      // Hide the loader.
      document.getElementById('loader').style.display = 'none';
    }
  },
  // Will use popup for IDP Providers sign-in flow instead of the default, redirect.
  signInFlow: 'popup',
  signInSuccessUrl: 'https://github.com/patterns/hello-hono',
  signInOptions: [
    // List of OAuth providers supported.
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
  ],
  // Terms of service url.
  tosUrl: 'https://github.com/patterns/',
  // Privacy policy url.
  privacyPolicyUrl: 'https://github.com/patterns/'
}

ui.start('#firebaseui-auth-container', uiConfig)


  </script>
    </head>
<body>
<h1>Welcome to </h1>
<div id="firebaseui-auth-container"></div>
<div id="loader">Loading...</div>
</body>
</html>`;
  return c.html(content)
})


app.post('/login_session', csrf(), async c => {
  const json = await c.req.json()
  const idToken = json.idToken
  if (!idToken || typeof idToken !== 'string') {
    return c.json({ message: 'invalid idToken' }, 400)
  }
  // Set session expiration to 5 days.
  const expiresIn = 60 * 60 * 24 * 5 * 1000
  // Create the session cookie. This will also verify the ID token in the process.
  // The session cookie will have the same claims as the ID token.
  // To only allow session cookie setting on recent sign-in, auth_time in ID token
  // can be checked to ensure user was recently signed in before creating a session cookie.
  const auth = AdminAuthApiClient.getOrInitialize(
    c.env.FIREBASE_PROJECT_ID,
    new ServiceAccountCredential(c.env.SERVICE_ACCOUNT_JSON)
  )
  const sessionCookie = await auth.createSessionCookie(
    idToken,
    expiresIn,
  )
  setCookie(c, 'session', sessionCookie, {
    maxAge: expiresIn,
    httpOnly: true,
    secure: true
  })
  return c.json({ message: 'success' })
})

// middleware
////app.use('/dash/*', csrf(), verifySessionCookieFirebaseAuth(config));
app.on(privilegedMethods, '/dash/*', async (c, next) => {
  const conf: VerifySessionCookieFirebaseAuthConfig = {
    projectId: c.env.FIREBASE_PROJECT_ID,
    keyStore: WorkersKVStoreSingle.getOrInitialize(c.env.PUBLIC_JWK_CACHE_KEY, c.env.PUBLIC_JWK_CACHE_KV),
    redirects: {
      signIn: "/login"
    }
  }

  const middle = verifySessionCookieFirebaseAuth(conf)
  return middle(c, next)
})


app.get('/dash/hello', (c) => {
  const idToken = getFirebaseToken(c) // get id-token object.
  return c.json(idToken)
})


app.onError((err, c) => {
	console.error(`${err}`)
	return c.text(err.toString())
})

app.notFound(c => c.text('Not found', 404))

app.get('/', (c) => {
  return c.html(
    <html>
      <head>

      </head>
      <body>
<h1>Welcome to PLACEHOLDER</h1>
<div id="firebaseui-auth-container"></div>
<div id="loader">Loading...</div>
      </body>
    </html>
  )
})

export default app
