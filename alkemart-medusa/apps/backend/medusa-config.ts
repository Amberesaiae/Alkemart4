import { loadEnv, defineConfig } from "@medusajs/framework/utils"
import { loadAppEnv } from "./src/lib/env"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const env = loadAppEnv()

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: env.DATABASE_URL,
    http: {
      storeCors: env.STORE_CORS,
      adminCors: env.ADMIN_CORS,
      authCors: env.AUTH_CORS,
      jwtSecret: env.JWT_SECRET,
      cookieSecret: env.COOKIE_SECRET,
    },
  },
  modules: [
    {
      resolve: "./src/modules/marketplace",
    },
  ],
})
