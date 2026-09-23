import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import type { ApiEnv } from "../../env"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

function testEnv(): ApiEnv {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET,
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

async function setup() {
  const authRepo = new InMemoryAuthRepository()
  const repo = new InMemoryCatalogRepository(emptyCatalog())
  const app = createApp({ authRepo, repo, jwtSecret: JWT_SECRET })
  const register = async (email: string, handle: string) => {
    const res = await app.request(
      "/vendor/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "VendorPass1", sellerName: `${handle} Shop`, sellerHandle: handle }),
      },
      testEnv(),
    )
    expect(res.status).toBe(201)
    const login = await app.request(
      "/vendor/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "VendorPass1" }),
      },
      testEnv(),
    )
    return ((await login.json()) as { token: string }).token
  }
  const token = await register("imp@alkemart.test", "imp-shop")
  const post = (body: unknown) =>
    app.request(
      "/vendor/imports",
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
      testEnv(),
    )
  return { app, repo, post }
}

const GOOD_CSV = [
  "title,category,price_ghs,stock,description,sku,brand,condition",
  "Tecno Spark 20,phones,899.99,5,Budget Android,TS20,Tecno,new",
  '"Ankara, Premium",women,250,0,,AG-1,,locally_used',
].join("\n")

describe("POST /vendor/imports (Phase 4E)", () => {
  it("dry-runs validation without writing, then commits to review", async () => {
    const { repo, post } = await setup()
    const dry = await post({ importKey: "k1", dryRun: true, csv: GOOD_CSV })
    expect(dry.status).toBe(200)
    const dryBody = (await dry.json()) as {
      rowCount: number
      createdCount: number
      rows: { row: number; ok: boolean; errors: string[]; productId: string | null; preview: { pricePesewas: string } | null }[]
    }
    expect(dryBody.rowCount).toBe(2)
    expect(dryBody.createdCount).toBe(2)
    expect(dryBody.rows[0]!.preview?.pricePesewas).toBe("89999")
    expect(dryBody.rows.every((r) => r.productId === null)).toBe(true)
    expect(repo.snapshot().products).toHaveLength(0)

    const commit = await post({ importKey: "k1", dryRun: false, csv: GOOD_CSV })
    expect(commit.status).toBe(200)
    const done = (await commit.json()) as {
      replayed: boolean
      createdCount: number
      failedCount: number
      rows: { ok: boolean; productId: string | null }[]
    }
    expect(done.replayed).toBe(false)
    expect(done.createdCount).toBe(2)
    expect(done.rows.every((r) => r.ok && r.productId)).toBe(true)
    // Imports land in the review queue, never directly published.
    expect(repo.snapshot().products.map((p) => p.status)).toEqual(["proposed", "proposed"])
    // Condition rides the first offer.
    const first = repo.snapshot().offers.find((o) => o.productId === done.rows[0]!.productId)
    expect(first?.condition).toBe("new")

    // Replay answers identically without duplicating.
    const replay = await post({ importKey: "k1", dryRun: false, csv: GOOD_CSV })
    const replayBody = (await replay.json()) as { replayed: boolean; createdCount: number }
    expect(replayBody.replayed).toBe(true)
    expect(replayBody.createdCount).toBe(2)
    expect(repo.snapshot().products).toHaveLength(2)
  })

  it("reports per-row errors and rejects bad files", async () => {
    const { repo, post } = await setup()
    const bad = await post({
      importKey: "k2",
      dryRun: true,
      csv: [
        "title,category,price_ghs,stock,condition",
        ",phones,10,1,new",
        "No Cat,atlantis,10,1,new",
        "Bad Price,phones,10.999,1,new",
        "Bad Stock,phones,10,-1,new",
        "Bad Cond,phones,10,1,used-ish",
        "Parent Cat,phones-electronics,10,1,new",
      ].join("\n"),
    })
    expect(bad.status).toBe(200)
    const body = (await bad.json()) as { rows: { row: number; ok: boolean; errors: string[] }[] }
    expect(body.rows).toHaveLength(6)
    expect(body.rows.every((r) => !r.ok)).toBe(true)
    expect(body.rows[0]!.errors).toContain("title required")
    expect(body.rows[1]!.errors.some((e) => e.includes("unknown category"))).toBe(true)
    expect(body.rows[2]!.errors.some((e) => e.includes("price_ghs"))).toBe(true)
    expect(body.rows[3]!.errors.some((e) => e.includes("stock"))).toBe(true)
    expect(body.rows[4]!.errors.some((e) => e.includes("condition"))).toBe(true)
    expect(body.rows[5]!.errors.some((e) => e.includes("leaf"))).toBe(true)
    expect(repo.snapshot().products).toHaveLength(0)

    const unknownCol = await post({
      importKey: "k3",
      dryRun: true,
      csv: "title,category,price_ghs,stock,color\nA,phones,10,1,red",
    })
    expect(unknownCol.status).toBe(400)
    const missingCol = await post({
      importKey: "k4",
      dryRun: true,
      csv: "title,category,price_ghs\nA,phones,10",
    })
    expect(missingCol.status).toBe(400)
    const empty = await post({ importKey: "k5", dryRun: true, csv: "title,category,price_ghs,stock\n" })
    expect(empty.status).toBe(400)
    const unbalanced = await post({
      importKey: "k6",
      dryRun: true,
      csv: 'title,category,price_ghs,stock\n"Broken,phones,10,1',
    })
    expect(unbalanced.status).toBe(400)
  })
})
