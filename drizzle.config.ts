
import type { Config } from "drizzle-kit";

const {
	LOCAL_DB_PATH,
	WRANGLER_CONFIG,
	DB_NAME = "d1-hello-hono",
} = process.env;

// Use better-sqlite driver for local development
export default LOCAL_DB_PATH
	? ({
			schema: "./src/schema.ts",
			driver: "better-sqlite",
			dbCredentials: {
				url: LOCAL_DB_PATH,
			},
		} satisfies Config)
	: ({
			dialect: "sqlite",
			schema: "./src/schema.ts",
			out: "./migrations",

			dbCredentials: {
				wranglerConfigPath:
					new URL("wrangler.toml", import.meta.url).pathname +
					// This is a hack to inject additional cli flags to wrangler
					// since drizzle-kit doesn't support specifying environments
					WRANGLER_CONFIG
						? ` ${WRANGLER_CONFIG}`
						: "",
				dbName: DB_NAME,
			},
		} satisfies Config);

