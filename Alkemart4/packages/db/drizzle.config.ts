import { defineConfig } from "drizzle-kit"

const databaseUrl = process.env.DATABASE_URL

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
})
