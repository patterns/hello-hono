import { Hono } from 'hono'
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

const privilegedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']


const app = new Hono<{Bindings: Bindings}>()
app.use(renderer)
app.use('/api/*', cors())


// start by requiring header (Authorization: Bearer)
app.on(privilegedMethods, '/api/*', async (c, next) => {
  // Single valid privileged token
  const bearer = bearerAuth({ token: c.env.BEARER_TOKEN })
  return bearer(c, next)
})

app.get('/api/users', async c => {
	const db = drizzle(c.env.DB)
	const result = await db.select({
	    name: members.name,
	    role: members.role,
	    guid: members.guid,
	}).from(members)
	return c.json(result)
})

app.get('/api/users/:guid', async c => {
	const { guid } = c.req.param()
	const db = drizzle(c.env.DB)
	const result = await db.select().from(members).where(eq(members.guid, guid))
	return c.json(result)
})

app.post('/api/users', async c => {
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


// admin-panel (dashboard)
app.get('/login', csrf(), async c => {
  const fbaKey = c.env.FIREBASE_API_KEY
  const fbaDomain = c.env.FIREBASE_AUTH_DOMAIN
  const fbaProject = c.env.FIREBASE_PROJECT_ID
  const content = await html`<html>
    <head>
      <meta charset="UTF-8" />
      <title>Login</title>
    </head>
    <body>
      <h1>Login Page</h1>
      <button id="sign-in" type="button">Sign-In</button>
      <script type="module">
        // See https://firebase.google.com/docs/auth/admin/manage-cookies
        //
        import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js';
        import $ from 'https://cdn.skypack.dev/jquery';
        // Add Firebase products that you want to use
        import {
          getAuth,
          signInWithPopup,
          OAuthProvider,
          onAuthStateChanged,
          signOut,
          setPersistence,
          inMemoryPersistence,
        } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js';
        const app = initializeApp({
          apiKey: '${fbaKey}',
          authDomain: '${fbaDomain}',
          projectId: '${fbaProject}',
        });
        const auth = getAuth(app);

        setPersistence(auth, inMemoryPersistence);

        /**
         * @param {string} name The cookie name.
         * @return {?string} The corresponding cookie value to lookup.
         */
        function getCookie(name) {
          const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
          return v ? v[2] : null;
        }

        /**
         * @param {string} url The session login endpoint.
         * @param {string} idToken The ID token to post to backend.
         * @return {any} A jQuery promise that resolves on completion.
         */
        function postIdTokenToSessionLogin(url, idToken) {
          // Purpose, used by login page (browser) to submit a post request to the server which records id token and derives session cookie.
          // (a non-js form submit could work also which can be visible as a page refresh)

          // POST to session login endpoint.
          return $.ajax({
            type: 'POST',
            url: url,
            data: JSON.stringify({ idToken: idToken }),
            contentType: 'application/json',
          });
        }

        $('#sign-in').on('click', function () {
          console.log('clicked');
          const provider = new OAuthProvider('google.com');
          // Start a sign in process for an unauthenticated user.
          provider.addScope('email');

          signInWithPopup(auth, provider)
            .then(({ user }) => {
              // Get the user's ID token as it is needed to exchange for a session cookie.
              const idToken = user.accessToken;
              // Session login endpoint is queried and the session cookie is set.
              // CSRF protection should be taken into account.
              // ...
              const csrfToken = getCookie('csrfToken');
              return postIdTokenToSessionLogin('/login_session', idToken, csrfToken);
            })
            .then(() => {
              // A page redirect would suffice as the persistence is set to NONE.
              return signOut(auth);
            })
            .then(() => {
              window.location.assign('/dash/hello');
            });
        });
      </script>
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
