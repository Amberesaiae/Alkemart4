import { shopFeatured } from "@alkemart/db"
import { asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export const MAX_FEATURED = 8

export interface ShopFeaturedStore {
  /** Ranked product ids (rank order) for a seller. */
  listFeatured(sellerId: string): Promise<string[]>
  /**
   * Replace the shelf wholesale. Rank follows array order (1-based).
   * Throws on >8 items or duplicates.
   */
  setFeatured(sellerId: string, productIds: string[]): Promise<string[]>
  /**
   * Picks for many shops at once — the stores index renders every open shop's
   * shelf, so reading them one at a time would be a query per card.
   */
  listFeaturedForShops(sellerIds: string[]): Promise<Map<string, string[]>>
}

export class PostgresShopFeaturedStore implements ShopFeaturedStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async listFeatured(sellerId: string): Promise<string[]> {
    const rows = await this.db
      .select({ productId: shopFeatured.productId })
      .from(shopFeatured)
      .where(eq(shopFeatured.sellerId, sellerId))
      .orderBy(asc(shopFeatured.rank))
    return rows.map((r) => r.productId)
  }

  async setFeatured(sellerId: string, productIds: string[]): Promise<string[]> {
    if (productIds.length > MAX_FEATURED) throw new Error("at most 8 featured products")
    if (new Set(productIds).size !== productIds.length) throw new Error("duplicate featured products")
    await this.db.transaction(async (tx) => {
      await tx.delete(shopFeatured).where(eq(shopFeatured.sellerId, sellerId))
      if (productIds.length > 0) {
        await tx.insert(shopFeatured).values(
          productIds.map((productId, i) => ({ sellerId, productId, rank: i + 1 })),
        )
      }
    })
    return this.listFeatured(sellerId)
  }

  /** Used by the storefront shop payload (delete-then-read in one tx client). */
  async listFeaturedForShops(sellerIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>()
    for (const id of sellerIds) out.set(id, await this.listFeatured(id))
    return out
  }
}

export class InMemoryShopFeaturedStore implements ShopFeaturedStore {
  private readonly ranks = new Map<string, string[]>()

  async listFeatured(sellerId: string): Promise<string[]> {
    return [...(this.ranks.get(sellerId) ?? [])]
  }

  async setFeatured(sellerId: string, productIds: string[]): Promise<string[]> {
    if (productIds.length > MAX_FEATURED) throw new Error("at most 8 featured products")
    if (new Set(productIds).size !== productIds.length) throw new Error("duplicate featured products")
    this.ranks.set(sellerId, [...productIds])
    return this.listFeatured(sellerId)
  }

  async listFeaturedForShops(sellerIds: string[]): Promise<Map<string, string[]>> {
    return new Map(sellerIds.map((id) => [id, [...(this.ranks.get(id) ?? [])]]))
  }
}
