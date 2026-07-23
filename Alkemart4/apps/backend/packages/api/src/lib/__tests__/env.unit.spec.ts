import { loadAppEnv, AppEnv } from "../env"

const validEnv: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "a".repeat(32),
  COOKIE_SECRET: "b".repeat(32),
  STORE_CORS: "http://localhost:3000",
  ADMIN_CORS: "http://localhost:7000",
  AUTH_CORS: "http://localhost:7000",
  VENDOR_CORS: "http://localhost:7001",
}

describe("loadAppEnv", () => {
  it("parses a valid env object", () => {
    const env = loadAppEnv(validEnv as NodeJS.ProcessEnv)
    expect(env.NODE_ENV).toBe("test")
    expect(env.DATABASE_URL).toBe("postgres://user:pass@localhost:5432/db")
    expect(env.DEFAULT_CURRENCY).toBe("ghs")
    expect(env.DEFAULT_COUNTRY_CODE).toBe("gh")
  })

  it("applies defaults for optional fields", () => {
    const env = loadAppEnv(validEnv as NodeJS.ProcessEnv)
    expect(env.DEFAULT_CURRENCY).toBe("ghs")
    expect(env.DEFAULT_COUNTRY_CODE).toBe("gh")
    expect(env.PAYSTACK_SECRET_KEY).toBeUndefined()
  })

  it("throws on missing required fields", () => {
    const partial = { NODE_ENV: "test" }
    expect(() => loadAppEnv(partial as NodeJS.ProcessEnv)).toThrow("Invalid environment configuration")
  })

  it("throws on invalid DATABASE_URL", () => {
    const env = { ...validEnv, DATABASE_URL: "not-a-url" }
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).toThrow("Invalid environment configuration")
  })

  it("throws on very short JWT_SECRET", () => {
    const env = { ...validEnv, JWT_SECRET: "short" }
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).toThrow("Invalid environment configuration")
  })

  it("throws on very short COOKIE_SECRET", () => {
    const env = { ...validEnv, COOKIE_SECRET: "short" }
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).toThrow("Invalid environment configuration")
  })

  it("allows lab-length secrets outside production", () => {
    const env = {
      ...validEnv,
      JWT_SECRET: "lab-jwt-secret-ok", // 17 chars
      COOKIE_SECRET: "lab-cookie-secret!!", // 19 chars
    }
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).not.toThrow()
  })

  const prodCors = {
    STORE_CORS: "https://shop.example.com",
    ADMIN_CORS: "https://admin.example.com",
    VENDOR_CORS: "https://seller.example.com",
    AUTH_CORS:
      "https://shop.example.com,https://admin.example.com,https://seller.example.com",
  }

  const prodBase = {
    ...validEnv,
    ...prodCors,
    NODE_ENV: "production",
    JWT_SECRET: "production_secret_key_that_is_long",
    COOKIE_SECRET: "production_cookie_secret_that_is_long",
    PAYSTACK_SECRET_KEY: "sk_live_xxx",
    FILE_DRIVER: "s3",
    S3_FILE_URL: "https://cdn.example.com",
    S3_BUCKET: "alkemart-media",
    S3_ACCESS_KEY_ID: "key",
    S3_SECRET_ACCESS_KEY: "secret",
  }

  it("requires 32+ char secrets in production", () => {
    const env = {
      ...prodBase,
      JWT_SECRET: "lab-jwt-secret-ok",
      COOKIE_SECRET: "lab-cookie-secret!!",
    }
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).toThrow(/at least 32 characters/)
  })

  it("rejects default secrets in production", () => {
    const env = {
      ...prodBase,
      JWT_SECRET: "a".repeat(32),
      COOKIE_SECRET: "supersecret" + "x".repeat(24),
    }
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).toThrow("Refusing to start with default secrets in production")
  })

  it("requires PAYSTACK_SECRET_KEY in production", () => {
    const env = {
      ...prodBase,
      PAYSTACK_SECRET_KEY: undefined,
    }
    delete (env as { PAYSTACK_SECRET_KEY?: string }).PAYSTACK_SECRET_KEY
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).toThrow("PAYSTACK_SECRET_KEY required in production")
  })

  it("passes production validation with all required fields", () => {
    expect(() => loadAppEnv(prodBase as NodeJS.ProcessEnv)).not.toThrow()
  })

  it("rejects FILE_DRIVER=local in production", () => {
    const env = {
      ...prodBase,
      FILE_DRIVER: "local",
    }
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).toThrow(
      /FILE_DRIVER=s3 required/,
    )
  })

  it("rejects wildcard CORS in production", () => {
    expect(() =>
      loadAppEnv({ ...prodBase, STORE_CORS: "*" } as NodeJS.ProcessEnv),
    ).toThrow(/wildcard/)
  })

  it("rejects localhost CORS in production", () => {
    expect(() =>
      loadAppEnv({
        ...prodBase,
        ADMIN_CORS: "http://localhost:7000",
      } as NodeJS.ProcessEnv),
    ).toThrow(/localhost/)
  })

  it("rejects non-https CORS in production", () => {
    expect(() =>
      loadAppEnv({
        ...prodBase,
        VENDOR_CORS: "http://seller.example.com",
      } as NodeJS.ProcessEnv),
    ).toThrow(/https/)
  })

  it("accepts https multi-origin CORS in production", () => {
    expect(() => loadAppEnv(prodBase as NodeJS.ProcessEnv)).not.toThrow()
  })
})
