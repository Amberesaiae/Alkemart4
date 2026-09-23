import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { demoCatalog, type CatalogSnapshot } from "../../demo-seed"
import type { ApiEnv } from "../../env"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

function testEnv(): ApiEnv {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars-long",
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

function emptyCatalog(): CatalogSnapshot {
  return {
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
    verifications: [],
    priceHistory: [],
  }
}

async function adminSetup(snapshot?: CatalogSnapshot) {
  const authRepo = new InMemoryAuthRepository()
  await authRepo.createUser({
    id: "admin-1",
    email: "admin@alkemart.test",
    passwordHash: await hashPassword("AdminPass1"),
    role: "admin",
  })
  const app = createApp({
    repo: new InMemoryCatalogRepository(snapshot ?? emptyCatalog()),
    authRepo,
    jwtSecret: "test-jwt-secret-that-is-at-least-32-chars-long",
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
  const token = ((await login.json()) as { token: string }).token
  const auth = (method = "GET") => ({
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  })
  return { app, auth }
}

/**
 * Phase 6E — guides ship as drafts, validate sections and links, publish
 * with live catalog picks, and unpublish/delete honestly.
 */
describe("admin guides (Phase 6E)", () => {
  it("creates drafts, validates, publishes, and revises", async () => {
    const { app, auth } = await adminSetup()
    const post = (path: string, body: unknown) =>
      app.request(path, { ...auth("POST"), body: JSON.stringify(body) }, testEnv())

    const created = await post("/admin/guides", {
      slug: "Test Guide",
      title: "Test Guide",
      excerpt: "An excerpt.",
      author: "Ed",
    })
    expect(created.status).toBe(201)
    expect(((await created.json()) as { guide: { slug: string; status: string } }).guide.slug).toBe("test-guide")

    const clash = await post("/admin/guides", {
      slug: "test-guide",
      title: "Other",
      excerpt: "An excerpt.",
      author: "Ed",
    })
    expect(clash.status).toBe(400)

    const empty = await post("/admin/guides/test-guide/publish", {})
    expect(empty.status).toBe(400)

    const patched = await app.request(
      "/admin/guides/test-guide",
      {
        ...auth("PATCH"),
        body: JSON.stringify({
          sections: [{ heading: "H", body: "B", picks: [{ query: "phone", limit: 4 }] }],
          relatedGuides: ["ghost"],
        }),
      },
      testEnv(),
    )
    expect(patched.status).toBe(400)

    const ok = await app.request(
      "/admin/guides/test-guide",
      {
        ...auth("PATCH"),
        body: JSON.stringify({
          sections: [{ heading: "H", body: "B", picks: [{ query: "phone" }] }],
        }),
      },
      testEnv(),
    )
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as { guide: { revision: number } }).guide.revision).toBe(2)

    const published = await post("/admin/guides/test-guide/publish", {})
    expect(((await published.json()) as { guide: { status: string } }).guide.status).toBe("published")

    const listed = await app.request("/store/guides", {}, testEnv())
    expect(((await listed.json()) as { items: { slug: string }[] }).items.map((g) => g.slug)).toContain(
      "test-guide",
    )

    const live = await post("/admin/guides/test-guide/publish", {})
    expect(live.status).toBe(200)
    const removed = await app.request("/admin/guides/test-guide", { ...auth("DELETE") }, testEnv())
    expect(removed.status).toBe(400)
    await post("/admin/guides/test-guide/unpublish", {})
    const deleted = await app.request("/admin/guides/test-guide", { ...auth("DELETE") }, testEnv())
    expect(deleted.status).toBe(200)
    const gone = await app.request("/admin/guides/test-guide", auth(), testEnv())
    expect(gone.status).toBe(404)
  })

  it("resolves picks to live cards and links related guides", async () => {
    const snapshot = demoCatalog()
    const { app } = await adminSetup(snapshot)
    const login = await app.request(
      "/admin/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@alkemart.test", password: "AdminPass1" }),
      },
      testEnv(),
    )
    const token = ((await login.json()) as { token: string }).token
    const auth = {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    }
    await app.request(
      "/admin/guides",
      { ...auth, body: JSON.stringify({ slug: "g1", title: "G1", excerpt: "E", author: "Ed" }) },
      testEnv(),
    )
    await app.request(
      "/admin/guides",
      { ...auth, body: JSON.stringify({ slug: "g2", title: "G2", excerpt: "E", author: "Ed" }) },
      testEnv(),
    )
    await app.request(
      "/admin/guides/g1",
      {
        method: "PATCH",
        headers: auth.headers,
        body: JSON.stringify({
          sections: [{ heading: "Picks", body: "Live.", picks: [{ label: "Phones", query: "Tecno" }] }],
          relatedGuides: ["g2"],
        }),
      },
      testEnv(),
    )
    await app.request("/admin/guides/g2", {
      method: "PATCH",
      headers: auth.headers,
      body: JSON.stringify({ sections: [{ heading: "More", body: "Words." }] }),
    }, testEnv())
    await app.request("/admin/guides/g1/publish", { ...auth, body: "{}" }, testEnv())
    await app.request("/admin/guides/g2/publish", { ...auth, body: "{}" }, testEnv())

    const res = await app.request("/store/guides/g1", {}, testEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      sections: { heading: string; picks: { label: string | null; cards: { productId: string }[] }[] }[]
      related: { slug: string }[]
    }
    expect(body.sections[0]!.picks[0]!.cards.map((c) => c.productId)).toContain("prod-tecno-spark")
    expect(body.related.map((g) => g.slug)).toEqual(["g2"])

    const draft = await app.request("/store/guides/g2", {}, testEnv())
    expect(draft.status).toBe(200)
  })
})
