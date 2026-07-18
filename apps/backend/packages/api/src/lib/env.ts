import { z } from "zod"

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  // Lab may use short secrets; production enforces ≥32 below
  JWT_SECRET: z.string().min(8),
  COOKIE_SECRET: z.string().min(8),
  STORE_CORS: z.string().min(1),
  ADMIN_CORS: z.string().min(1),
  AUTH_CORS: z.string().min(1),
  VENDOR_CORS: z.string().min(1),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  DEFAULT_CURRENCY: z.string().default("ghs"),
  DEFAULT_COUNTRY_CODE: z.string().default("gh"),
  /** File storage: local (lab) or s3 (R2/S3 production). */
  FILE_DRIVER: z.enum(["local", "s3"]).default("local"),
  FILE_BACKEND_URL: z.string().optional(),
  S3_FILE_URL: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_PREFIX: z.string().optional(),
  /** When true (default), proposed products require full seller setup. */
  ALKEMART_STRICT_PROPOSE_GATES: z.string().optional(),
  ALKEMART_REQUIRE_CATEGORY_ON_PROPOSE: z.string().optional(),
})

export type AppEnv = z.infer<typeof EnvSchema>

function assertProductionCors(label: string, value: string) {
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (!parts.length) {
    throw new Error(`${label} must list at least one origin in production`)
  }
  for (const origin of parts) {
    if (origin === "*" || origin.includes("*")) {
      throw new Error(`${label} must not use wildcard origins in production (got "${origin}")`)
    }
    if (
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.includes("[::1]")
    ) {
      throw new Error(
        `${label} must not include localhost/loopback origins in production (got "${origin}")`,
      )
    }
    if (!/^https:\/\//i.test(origin)) {
      throw new Error(
        `${label} production origins must use https:// (got "${origin}")`,
      )
    }
  }
}

export function loadAppEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(raw)
  if (!parsed.success) {
    console.error("Environment validation failed:", parsed.error.flatten().fieldErrors)
    throw new Error("Invalid environment configuration")
  }
  if (parsed.data.NODE_ENV === "production") {
    if (parsed.data.JWT_SECRET.length < 32 || parsed.data.COOKIE_SECRET.length < 32) {
      throw new Error("JWT_SECRET and COOKIE_SECRET must be at least 32 characters in production")
    }
    if (parsed.data.JWT_SECRET.includes("supersecret") || parsed.data.COOKIE_SECRET.includes("supersecret")) {
      throw new Error("Refusing to start with default secrets in production")
    }
    if (!parsed.data.PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY required in production")
    }
    if (parsed.data.FILE_DRIVER === "local") {
      throw new Error("FILE_DRIVER=s3 required in production (local disk is not multi-instance safe)")
    }
    if (!parsed.data.S3_FILE_URL || !parsed.data.S3_BUCKET) {
      throw new Error("S3_FILE_URL and S3_BUCKET required when FILE_DRIVER=s3 in production")
    }
    if (!parsed.data.S3_ACCESS_KEY_ID || !parsed.data.S3_SECRET_ACCESS_KEY) {
      throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY required in production")
    }
    if (!/^https:\/\//i.test(parsed.data.S3_FILE_URL)) {
      throw new Error("S3_FILE_URL must be https:// in production")
    }
    assertProductionCors("STORE_CORS", parsed.data.STORE_CORS)
    assertProductionCors("ADMIN_CORS", parsed.data.ADMIN_CORS)
    assertProductionCors("VENDOR_CORS", parsed.data.VENDOR_CORS)
    assertProductionCors("AUTH_CORS", parsed.data.AUTH_CORS)
  }
  return parsed.data
}
