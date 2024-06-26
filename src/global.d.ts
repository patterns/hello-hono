import {} from 'hono'

declare module 'hono' {
  interface ContextRenderer {
    (content: string | Promise<string>, props?: { title?: string }): Response
  }

  interface Env {
    Bindings: {
      DB: D1Database
      SERVICE_ACCOUNT_JSON: string
      POLICY_AUD: string
      JWKS_URI: string
      VERIFY_RSA_JWT: string
      PUBLIC_JWK_CACHE_KV: string
      PUBLIC_JWK_CACHE_KEY: string
      FIREBASE_PROJECT_ID: string
      FIREBASE_API_KEY: string
      FIREBASE_AUTH_DOMAIN: string
      FIREBASE_STORAGE_BUCKET: string
    }
  }

  interface Member {
    name: string
    email: string
    role: string
    guid: string
  }

  interface Course {
    title: string
    description: string
    category: string
    url: string
    guid: string
  }
}
