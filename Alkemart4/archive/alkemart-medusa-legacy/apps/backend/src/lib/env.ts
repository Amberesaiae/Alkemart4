import { z } from "zod"

const FORBIDDEN_SECRETS = new Set(["supersecret", "secret", "changeme", "change-me"])

/** Treat empty / null env values as unset for optional keys. */
const optionalString = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().min(1).optional()
)

/**
 * Application environment schema.
 *
 * Development allows shorter secrets (min 8) so local `.env` values like
 * `supersecret` still work. Production enforces min 32, rejects default
 * secrets, and requires Paystack + marketplace seed IDs.
 */
export const appEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.url(),
    REDIS_URL: z.string().min(1),
    JWT_SECRET: z.string().min(8),
    COOKIE_SECRET: z.string().min(8),
    STORE_CORS: z.string().min(1),
    ADMIN_CORS: z.string().min(1),
    AUTH_CORS: z.string().min(1),
    ALKEMART_REGION_ID: optionalString,
    ALKEMART_SALES_CHANNEL_ID: optionalString,
    ALKEMART_PUBLISHABLE_KEY: optionalString,
    PAYSTACK_SECRET_KEY: optionalString,
    PAYSTACK_PUBLIC_KEY: optionalString,
    DEFAULT_CURRENCY: z.string().min(1).default("ghs"),
    DEFAULT_COUNTRY_CODE: z.string().min(1).default("gh"),
    PAYMENT_PENDING_TTL_MINUTES: z.coerce
      .number()
      .min(10)
      .max(120)
      .default(30),
    DEFAULT_COMMISSION_BPS: z.coerce.number().default(700),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") {
      return
    }

    if (data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "JWT_SECRET must be at least 32 characters in production",
      })
    }
    if (data.COOKIE_SECRET.length < 32) {
      ctx.addIssue({
        code: "custom",
        path: ["COOKIE_SECRET"],
        message: "COOKIE_SECRET must be at least 32 characters in production",
      })
    }

    if (FORBIDDEN_SECRETS.has(data.JWT_SECRET.toLowerCase())) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message:
          'JWT_SECRET cannot be a default/placeholder value (e.g. "supersecret") in production',
      })
    }
    if (FORBIDDEN_SECRETS.has(data.COOKIE_SECRET.toLowerCase())) {
      ctx.addIssue({
        code: "custom",
        path: ["COOKIE_SECRET"],
        message:
          'COOKIE_SECRET cannot be a default/placeholder value (e.g. "supersecret") in production',
      })
    }

    if (!data.PAYSTACK_SECRET_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["PAYSTACK_SECRET_KEY"],
        message: "PAYSTACK_SECRET_KEY is required in production",
      })
    }
    if (!data.ALKEMART_REGION_ID) {
      ctx.addIssue({
        code: "custom",
        path: ["ALKEMART_REGION_ID"],
        message: "ALKEMART_REGION_ID is required in production",
      })
    }
    if (!data.ALKEMART_SALES_CHANNEL_ID) {
      ctx.addIssue({
        code: "custom",
        path: ["ALKEMART_SALES_CHANNEL_ID"],
        message: "ALKEMART_SALES_CHANNEL_ID is required in production",
      })
    }
  })

export type AppEnv = z.infer<typeof appEnvSchema>

function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)"
      return `  - ${path}: ${issue.message}`
    })
    .join("\n")
}

/**
 * Parse and validate application env from `process.env` (or a test object).
 * Throws a clear Error listing every invalid field.
 */
export function loadAppEnv(
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): AppEnv {
  const result = appEnvSchema.safeParse(source)
  if (!result.success) {
    throw new Error(
      `Invalid application environment:\n${formatEnvIssues(result.error)}`
    )
  }
  return result.data
}
