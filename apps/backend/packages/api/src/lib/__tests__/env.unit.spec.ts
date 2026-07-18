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

  it("throws on short JWT_SECRET", () => {
    const env = { ...validEnv, JWT_SECRET: "short" }
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).toThrow("Invalid environment configuration")
  })

  it("throws on short COOKIE_SECRET", () => {
    const env = { ...validEnv, COOKIE_SECRET: "short" }
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).toThrow("Invalid environment configuration")
  })

  it("rejects default secrets in production", () => {
    const env = { ...validEnv, NODE_ENV: "production", JWT_SECRET: "a".repeat(32), COOKIE_SECRET: "supersecret" + "x".repeat(24) }
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).toThrow("Refusing to start with default secrets in production")
  })

  it("requires PAYSTACK_SECRET_KEY in production", () => {
    const env = {
      ...validEnv,
      NODE_ENV: "production",
      JWT_SECRET: "production_secret_key_that_is_long",
      COOKIE_SECRET: "production_cookie_secret_that_is_long",
      PAYSTACK_SECRET_KEY: undefined,
    }
    delete env.PAYSTACK_SECRET_KEY
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).toThrow("PAYSTACK_SECRET_KEY required in production")
  })

  it("passes production validation with all required fields", () => {
    const env = {
      ...validEnv,
      NODE_ENV: "production",
      JWT_SECRET: "production_secret_key_that_is_long",
      COOKIE_SECRET: "production_cookie_secret_that_is_long",
      PAYSTACK_SECRET_KEY: "sk_live_xxx",
    }
    expect(() => loadAppEnv(env as NodeJS.ProcessEnv)).not.toThrow()
  })
})
