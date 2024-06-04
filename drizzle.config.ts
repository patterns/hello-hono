import { defineConfig } from "drizzle-kit"

export default defineConfig({
	dialect: "sqlite",
	driver: "d1-http",
	schema: "./src/schema.ts",
	out: "./migrations",
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
		databaseId: process.env.CLOUDFLARE_DATABASE_ID,
		token: process.env.CLOUDFLARE_API_TOKEN,
	},
})

