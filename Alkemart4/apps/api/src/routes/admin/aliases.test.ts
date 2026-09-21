import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { describe, expect, it } from "vitest"
import { InMemoryAdminAuditLog } from "../../admin-audit"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import { hashPassword } from "@alkemart/domain"
import { createApp } from "../../index"

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

function testEnv() {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET,
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

async function adminHarness() {
  const authRepo = new InMemoryAuthRepository()
  await authRepo.createUser({
    id: "admin-1",
    email: "admin@alkemart.test",
    passwordHash: await hashPassword("AdminPass1"),
    role: "admin",
  })
  const snapshot: CatalogSnapshot = {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    sellers: [],
    products: [],
    variants: [],
    offers: [],
    productOptions: [],
    productOptionValues: [],
    variantOptionValues: [],
    attributeDefinitions: [],
    attributeProfiles: [],
    profileAttributes: [],
    productAttributeValues: [],
    matchCandidates: [],
    searchAliases: [],
  }
  const app = createApp({
    authRepo,
    repo: new InMemoryCatalogRepository(snapshot),
    checkoutRepo: new InMemoryCheckoutRepository(snapshot),
    auditLog: new InMemoryAdminAuditLog(),
    jwtSecret: JWT_SECRET,
  })
  const login = await app.request(
    "/admin/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@alkemart.test", password: "AdminPass1" }),
    },
    testEnv(),
  )
  const { token } = (await login.json()) as { token: string }
  const admin = (method: string, path: string, body?: unknown) =>
    app.request(
      path,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
      testEnv(),
    )
  return { app, admin }
}

describe("Phase 2C/2D — alias governance and search telemetry", () => {
  it("proposes, approves, and reports alias + outbox status", async () => {
    const { admin } = await adminHarness()

    const proposed = await admin("POST", "/admin/aliases", {
      term: "fridge",
      target: "refrigerator",
      type: "synonym",
    })
    expect(proposed.status).toBe(201)
    const { alias } = (await proposed.json()) as { alias: { id: string; status: string } }
    expect(alias.status).toBe("proposed")

    // Duplicate live terms conflict; rejected terms can be re-proposed.
    const dupe = await admin("POST", "/admin/aliases", {
      term: "Fridge",
      target: "other",
      type: "synonym",
    })
    expect(dupe.status).toBe(409)

    const reviewed = await admin("POST", `/admin/aliases/${alias.id}/review`, {
      decision: "approved",
    })
    expect(reviewed.status).toBe(200)

    const status = await admin("GET", "/admin/search/status")
    expect(status.status).toBe(200)
    const body = (await status.json()) as {
      outboxPending: number
      aliasesProposed: number
      aliasesApproved: number
    }
    expect(body.aliasesApproved).toBe(1)
    expect(body.aliasesProposed).toBe(0)
    expect(body.outboxPending).toBeGreaterThan(0)
  })

  it("surfaces the zero-result queue", async () => {
    const { app, admin } = await adminHarness()
    await app.request("/store/search?q=nosuchthinghere", {}, testEnv())
    const queue = await admin("GET", "/admin/search/zero-result")
    expect(queue.status).toBe(200)
    const { items } = (await queue.json()) as { items: Array<{ query: string }> }
    expect(items.map((i) => i.query)).toContain("nosuchthinghere")
  })
})
