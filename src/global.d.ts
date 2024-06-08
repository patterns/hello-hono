import {} from 'hono'

declare module 'hono' {
  interface ContextRenderer {
    (content: string | Promise<string>, props?: { title?: string }): Response
  }

  interface Env {
    Bindings: {
      DB: D1Database
      BEARER_TOKEN: string
      SERVICE_ACCOUNT_JSON: string
      PUBLIC_JWK_CACHE_KV: string
      PUBLIC_JWK_CACHE_KEY: string
      FIREBASE_PROJECT_ID: string
      FIREBASE_API_KEY: string
      FIREBASE_AUTH_DOMAIN: string
    }
  }

  interface Member {
    name: string
    email: string
    role: string
  }
}
