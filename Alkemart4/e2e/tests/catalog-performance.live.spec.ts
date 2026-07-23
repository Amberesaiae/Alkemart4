/**
 * Live catalog performance contracts (P1.1 + P1.4).
 *
 * - strategy light_ids_then_heavy_page
 * - every card has offer_id (ATC spine)
 * - Redis cache miss → hit when Redis is up
 *
 * Run (API up, PK in env or storefront .env):
 *   cd e2e && bunx playwright test tests/catalog-performance.live.spec.ts
 */

import { test, expect } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { API, publishableKey } from "../lib/env"
import { getCatalog, getJson } from "../lib/api"

function resolvePublishableKey(): string {
  let key = publishableKey()
  if (key) return key
  for (const f of [
    path.join(__dirname, "../../apps/storefront/.env"),
    "/home/amber/alkemart-storefront/.env",
  ]) {
    if (!fs.existsSync(f)) continue
    const m = fs
      .readFileSync(f, "utf8")
      .match(/^VITE_MEDUSA_PUBLISHABLE_KEY=(.+)$/m)
    if (m) {
      return m[1].trim().replace(/^["']|["']$/g, "")
    }
  }
  return ""
}

test.describe("catalog performance live", () => {
  test("P1.1 strategy + offer_id + price on catalog cards", async () => {
    const key = resolvePublishableKey()
    expect(key, "publishable key required").toBeTruthy()

    const cat = await getCatalog(key, 5)
    expect(cat.status).toBe(200)
    const products = (cat.json?.products ?? []) as {
      id?: string
      title?: string
      offer_id?: string
      min_price?: number | null
    }[]
    expect(products.length, "catalog must not be empty").toBeGreaterThan(0)
    expect(cat.json?.strategy).toBe("light_ids_then_heavy_page")
    for (const p of products) {
      expect(p.offer_id, `offer_id on ${p.title || p.id}`).toBeTruthy()
      expect(
        p.min_price != null,
        `min_price on ${p.title || p.id}`,
      ).toBeTruthy()
    }
  })

  test("P1.4 Redis catalog cache miss then hit", async () => {
    const key = resolvePublishableKey()
    expect(key, "publishable key required").toBeTruthy()

    // Purge via unique query first is not enough; miss after gen bump needs Redis.
    // Use limit=7 page that may be cold, or force by requesting after small delay.
    // Best-effort: hit twice same key — second must be hit if first warmed cache.
    const url = `${API}/store/alkemart/catalog?limit=5&offset=0`
    const headers = { "x-publishable-api-key": key }

    // Warm or cold first request
    const first = await getJson(url, headers)
    expect(first.status).toBe(200)
    expect(
      ["hit", "miss"].includes(String(first.json?.cache)),
      `cache field present (got ${first.json?.cache})`,
    ).toBeTruthy()

    const second = await getJson(url, headers)
    expect(second.status).toBe(200)
    // After any successful miss or hit, second request should be hit when Redis works.
    // If cache disabled, both may omit or be miss — soft-fail only when first was miss.
    if (first.json?.cache === "miss") {
      expect(second.json?.cache).toBe("hit")
    } else if (first.json?.cache === "hit") {
      expect(second.json?.cache).toBe("hit")
    }
    expect(second.json?.strategy).toBe("light_ids_then_heavy_page")
  })
})
