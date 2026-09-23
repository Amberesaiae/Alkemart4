import { Hono } from "hono"
import type { CategoryNode } from "@alkemart/domain"
import type { AppEnv } from "../../context"
import { edgeCache } from "../../lib/edge-cache"

export type SitemapUrl = {
  /** Root-relative path; the prerender step absolutizes with the site origin. */
  path: string
  type: "product" | "category" | "shop" | "collection"
  updatedAt: string | null
}

/**
 * Phase 6C — live sitemap source. Only indexable truth goes out: published
 * products with a sellable offer, browsable nav categories, open shops
 * (paused shops stay listed — their pages state the pause, same as the
 * PDP), and live (published, in-window) non-empty collections. Drafts and
 * empty shelves never appear. The build-time prerender absolutizes paths
 * and emits the segmented XML maps.
 */
export const storeSitemap = new Hono<AppEnv>().get("/", async (c) => {
  const repo = c.get("repo")
  const urls: SitemapUrl[] = []

  const [catalog, openSellers] = await Promise.all([
    repo.listCatalog({ limit: 1000, offset: 0 }).catch(() => ({ items: [], total: 0 })),
    repo.listOpenSellers().catch(() => []),
  ])
  // listCatalog default ordering is title-asc and stable; cards only exist
  // for products with a sellable offer, which is exactly the indexable set.
  for (const card of catalog.items) {
    urls.push({
      path: `/product/${card.slug ? `${card.slug}-${card.productId}` : card.productId}`,
      type: "product",
      updatedAt: card.createdAt ?? null,
    })
  }
  // NOTE: listCatalog caps at 1000 — the sitemap covers the head of the
  // catalog. When the catalog outgrows it, paginate here (offset loop).

  const categories = await repo.listCategories().catch(() => [])
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const n of nodes) {
      // Roots stay crawlable as hubs; every leaf is a landing page.
      if (n.children.length === 0 || depth === 0) {
        urls.push({ path: `/categories/${n.handle}`, type: "category", updatedAt: null })
      }
      walk(n.children, depth + 1)
    }
  }
  walk(categories, 0)

  const store = c.get("collections")
  // Bounded fan-out: one collections read per shop, capped — the sitemap is
  // build-time output, not an unbounded join endpoint.
  for (const seller of openSellers.slice(0, 500)) {
    urls.push({ path: `/shops/${seller.handle}`, type: "shop", updatedAt: null })
    const live = await store.listPublishedBySeller(seller.id).catch(() => [])
    for (const shelf of live) {
      if (shelf.productIds.length === 0) continue
      urls.push({
        path: `/shops/collections/${shelf.id}?shop=${encodeURIComponent(seller.handle)}`,
        type: "collection",
        updatedAt: shelf.createdAt ?? null,
      })
    }
  }

  edgeCache(c, "build")
  return c.json({ urls, count: urls.length })
})
