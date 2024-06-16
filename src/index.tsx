import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { html } from 'hono/html'
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

import { renderer } from './renderer'
import users from './users'
import courses from './courses'

const app = new Hono<{Bindings: Bindings}>()
app.use(renderer)
app.use('/api/*', cors())
app.route('/api/users', users)
app.route('/api/courses', courses)

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

/*
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
*/

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
