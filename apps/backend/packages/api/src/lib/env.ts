import { z } from "zod"

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  STORE_CORS: z.string().min(1),
  ADMIN_CORS: z.string().min(1),
  AUTH_CORS: z.string().min(1),
  VENDOR_CORS: z.string().min(1),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  DEFAULT_CURRENCY: z.string().default("ghs"),
  DEFAULT_COUNTRY_CODE: z.string().default("gh"),
})

export type AppEnv = z.infer<typeof EnvSchema>

export function loadAppEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(raw)
  if (!parsed.success) {
    console.error("Environment validation failed:", parsed.error.flatten().fieldErrors)
    throw new Error("Invalid environment configuration")
  }
  if (parsed.data.NODE_ENV === "production") {
    if (parsed.data.JWT_SECRET.includes("supersecret") || parsed.data.COOKIE_SECRET.includes("supersecret")) {
      throw new Error("Refusing to start with default secrets in production")
    }
    if (!parsed.data.PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY required in production")
    }
  }
  return parsed.data
}
