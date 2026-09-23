import { describe, expect, it } from "vitest"
import { hashPassword } from "@alkemart/domain"
import { InMemoryAuthRepository } from "../../auth-repository"
import { parseEnv } from "../../env"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

function jwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1]
  if (!part) throw new Error("token has no payload")
  const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4)
  return JSON.parse(atob(padded)) as Record<string, unknown>
}

function jwtHeader(token: string): Record<string, unknown> {
  const part = token.split(".")[0]
  if (!part) throw new Error("token has no header")
  const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4)
  return JSON.parse(atob(padded)) as Record<string, unknown>
}

async function authApp(seed?: (repo: InMemoryAuthRepository) => Promise<void>) {
  const authRepo = new InMemoryAuthRepository()
  await seed?.(authRepo)
  return { app: createApp({ authRepo, jwtSecret: JWT_SECRET }), authRepo }
}

function jsonPost(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return { method: "POST" as const, headers, body: JSON.stringify(body) }
}

describe("parseEnv auth secrets", () => {
  const bindings = {
    ENVIRONMENT: "development",
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }

  it("requires JWT_SECRET and leaves PAYSTACK_SECRET_KEY optional", () => {
    expect(() => parseEnv(bindings)).toThrow(/JWT_SECRET/)
    const env = parseEnv({ ...bindings, JWT_SECRET })
    expect(env.JWT_SECRET).toBe(JWT_SECRET)
    expect(env.PAYSTACK_SECRET_KEY).toBeUndefined()
  })
})

describe("vendor register / login", () => {
  it("register vendor yields sellerId on token claims and pending_approval seller", async () => {
    const { app, authRepo } = await authApp()
    const res = await app.request(
      "/vendor/auth/register",
      jsonPost("/vendor/auth/register", {
        email: "vendor@alkemart.test",
        password: "VendorPass1",
        sellerName: "Accra Mart",
        sellerHandle: "accra-mart",
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      token: string
      user: { id: string; email: string; role: string; sellerId?: string }
    }
    expect(jwtHeader(body.token).alg).toBe("HS256")
    const claims = jwtPayload(body.token)
    expect(claims.userId).toBe(body.user.id)
    expect(claims.role).toBe("seller_member")
    expect(typeof claims.sellerId).toBe("string")
    expect(claims.sellerId).toBeTruthy()
    expect(body.user.role).toBe("seller_member")
    expect(body.user.sellerId).toBe(claims.sellerId)

    const seller = await authRepo.findSellerById(String(claims.sellerId))
    expect(seller?.status).toBe("pending_approval")
    expect(seller?.handle).toBe("accra-mart")
    expect(seller?.name).toBe("Accra Mart")
    const member = await authRepo.findSellerMemberByUserId(body.user.id)
    expect(member).toEqual({
      userId: body.user.id,
      sellerId: claims.sellerId,
      role: "owner",
    })

    const me = await app.request("/vendor/me", {
      headers: { Authorization: `Bearer ${body.token}` },
    })
    expect(me.status).toBe(200)
    expect(await me.json()).toEqual({
      userId: body.user.id,
      role: "seller_member",
      sellerId: claims.sellerId,
    })

    const login = await app.request(
      "/vendor/auth/login",
      jsonPost("/vendor/auth/login", { email: "vendor@alkemart.test", password: "VendorPass1" }),
    )
    expect(login.status).toBe(200)
    const loginBody = (await login.json()) as { token: string }
    expect(jwtPayload(loginBody.token).sellerId).toBe(claims.sellerId)
  })
})

describe("store register / login + requireSeller", () => {
  it("buyer token cannot hit requireSeller", async () => {
    const { app } = await authApp()
    const res = await app.request(
      "/store/auth/register",
      jsonPost("/store/auth/register", { email: "buyer@alkemart.test", password: "BuyerPass1" }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      token: string
      user: { id: string; email: string; role: string; sellerId?: string }
    }
    expect(body.user.role).toBe("buyer")
    expect(body.user.sellerId).toBeUndefined()
    expect(jwtPayload(body.token).role).toBe("buyer")
    expect(jwtPayload(body.token).sellerId).toBeUndefined()

    const blocked = await app.request("/vendor/me", {
      headers: { Authorization: `Bearer ${body.token}` },
    })
    expect(blocked.status).toBe(403)

    const login = await app.request(
      "/store/auth/login",
      jsonPost("/store/auth/login", { email: "buyer@alkemart.test", password: "BuyerPass1" }),
    )
    expect(login.status).toBe(200)
    const loginBody = (await login.json()) as { token: string; user: { role: string } }
    expect(loginBody.user.role).toBe("buyer")
    expect(jwtPayload(loginBody.token).sellerId).toBeUndefined()
  })
})

describe("admin login", () => {
  it("logs in a seeded admin and rejects a buyer", async () => {
    const { app } = await authApp(async (repo) => {
      await repo.createUser({
        id: "admin-1",
        email: "admin@alkemart.test",
        passwordHash: await hashPassword("AdminPass1"),
        role: "admin",
      })
      await repo.createUser({
        id: "buyer-1",
        email: "buyer-admin@alkemart.test",
        passwordHash: await hashPassword("BuyerPass1"),
        role: "buyer",
      })
    })

    const ok = await app.request(
      "/admin/auth/login",
      jsonPost("/admin/auth/login", { email: "admin@alkemart.test", password: "AdminPass1" }),
    )
    expect(ok.status).toBe(200)
    const okBody = (await ok.json()) as { token: string; user: { role: string } }
    expect(okBody.user.role).toBe("admin")
    expect(jwtPayload(okBody.token).role).toBe("admin")

    const me = await app.request("/admin/me", {
      headers: { Authorization: `Bearer ${okBody.token}` },
    })
    expect(me.status).toBe(200)

    const denied = await app.request(
      "/admin/auth/login",
      jsonPost("/admin/auth/login", { email: "buyer-admin@alkemart.test", password: "BuyerPass1" }),
    )
    expect(denied.status).toBe(401)

    const buyerReg = await app.request(
      "/store/auth/login",
      jsonPost("/store/auth/login", { email: "buyer-admin@alkemart.test", password: "BuyerPass1" }),
    )
    const buyerToken = ((await buyerReg.json()) as { token: string }).token
    const adminBlocked = await app.request("/admin/me", {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    expect(adminBlocked.status).toBe(403)
  })
})
