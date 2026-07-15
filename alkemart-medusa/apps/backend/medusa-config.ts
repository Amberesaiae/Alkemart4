import { loadEnv, defineConfig } from "@medusajs/framework/utils"
import { loadAppEnv } from "./src/lib/env"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const env = loadAppEnv()

// Build modules list. Paystack provider is only registered when
// PAYSTACK_SECRET_KEY is set so local/dev can boot without keys.
const modules: Array<Record<string, unknown>> = [
  {
    resolve: "./src/modules/marketplace",
  },
  {
    resolve: "./src/modules/payments-ghana",
  },
]

if (env.PAYSTACK_SECRET_KEY) {
  modules.push({
    resolve: "@medusajs/medusa/payment",
    options: {
      providers: [
        {
          resolve: "./src/modules/paystack",
          id: "paystack",
          options: {
            secretKey: env.PAYSTACK_SECRET_KEY,
            publicKey: env.PAYSTACK_PUBLIC_KEY,
          },
        },
      ],
    },
  })
}
// else: Paystack skipped — set PAYSTACK_SECRET_KEY to enable provider registration

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
  modules,
})
