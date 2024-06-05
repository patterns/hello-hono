import {} from 'hono'

declare module 'hono' {
  interface ContextRenderer {
    (content: string | Promise<string>, props?: { title?: string }): Response
  }

  interface Env {
    Bindings: { DB: D1Database }
  }

  interface Member {
    name: string
    email: string
    role: string
  }
}
