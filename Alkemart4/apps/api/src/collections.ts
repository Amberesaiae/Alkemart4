import { collectionProducts, collections } from "@alkemart/db"
import { and, asc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/**
 * Blueprint Phase 4A — vendor collections (ADR-003).
 * Seller-owned merchandising shelves; many-to-many with products; never
 * alters canonical classification. Visibility + schedule gate the public
 * read path; drafts and out-of-window collections are invisible to buyers.
 */

export const MAX_COLLECTION_PRODUCTS = 30
export const MAX_COLLECTIONS_PER_SELLER = 20

export class CollectionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CollectionValidationError"
  }
}

export class CollectionConflictError extends Error {
  constructor(message = "collection already exists") {
    super(message)
    this.name = "CollectionConflictError"
  }
}

export type CollectionVisibility = "draft" | "published"

export type CollectionDto = {
  id: string
  sellerId: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  visibility: CollectionVisibility
  position: number
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  /** Member product ids in rank order. */
  productIds: string[]
}

export type CreateCollectionInput = {
  name: string
  slug?: string | null
  description?: string | null
  imageUrl?: string | null
  visibility?: CollectionVisibility
}

export type UpdateCollectionInput = {
  name?: string
  slug?: string | null
  description?: string | null
  imageUrl?: string | null
  visibility?: CollectionVisibility
  position?: number
  startsAt?: string | null
  endsAt?: string | null
}

export interface CollectionsStore {
  listVendorCollections(sellerId: string): Promise<CollectionDto[]>
  createCollection(sellerId: string, input: CreateCollectionInput): Promise<CollectionDto>
  updateCollection(
    sellerId: string,
    id: string,
    patch: UpdateCollectionInput,
  ): Promise<CollectionDto | null>
  deleteCollection(sellerId: string, id: string): Promise<boolean>
  /**
   * Replace membership wholesale (rank = array order). Every product must
   * exist and belong to the seller's catalog; classification is untouched.
   */
  setCollectionProducts(
    sellerId: string,
    id: string,
    productIds: string[],
  ): Promise<CollectionDto | null>
  /** Buyer-visible shelves: published + inside the schedule window. */
  listPublishedBySeller(sellerId: string, now?: Date): Promise<CollectionDto[]>
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || crypto.randomUUID().slice(0, 8)
}

function cleanText(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

function parseMoment(raw: string | null | undefined, field: string): Date | null {
  if (raw == null || raw === "") return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw new CollectionValidationError(`${field} is not a valid date`)
  return d
}

function isLive(
  row: { visibility: string; startsAt: Date | string | null; endsAt: Date | string | null },
  now: Date,
): boolean {
  if (row.visibility !== "published") return false
  const start = row.startsAt ? new Date(row.startsAt) : null
  const end = row.endsAt ? new Date(row.endsAt) : null
  if (start && start.getTime() > now.getTime()) return false
  if (end && end.getTime() <= now.getTime()) return false
  return true
}

type CollectionRow = {
  id: string
  sellerId: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  visibility: CollectionVisibility
  position: number
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

function toDto(row: CollectionRow, productIds: string[]): CollectionDto {
  return { ...row, productIds: [...productIds] }
}

export class InMemoryCollectionsStore implements CollectionsStore {
  private readonly rows = new Map<string, CollectionRow>()
  private readonly members = new Map<string, string[]>()

  /**
   * @param isOwnProduct catalog ownership check (product exists + seller
   * sells it). Injected so this store never fabricates catalog facts.
   */
  constructor(private readonly isOwnProduct: (sellerId: string, productId: string) => boolean) {}

  private owned(sellerId: string): CollectionRow[] {
    return [...this.rows.values()]
      .filter((r) => r.sellerId === sellerId)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
  }

  async listVendorCollections(sellerId: string): Promise<CollectionDto[]> {
    return this.owned(sellerId).map((r) => toDto(r, this.members.get(r.id) ?? []))
  }

  async createCollection(sellerId: string, input: CreateCollectionInput): Promise<CollectionDto> {
    const name = input.name?.trim()
    if (!name) throw new CollectionValidationError("name required")
    if (name.length > 80) throw new CollectionValidationError("name must be 80 characters or fewer")
    const mine = this.owned(sellerId)
    if (mine.length >= MAX_COLLECTIONS_PER_SELLER) {
      throw new CollectionValidationError(`at most ${MAX_COLLECTIONS_PER_SELLER} collections per shop`)
    }
    const base = slugify(input.slug?.trim() ? input.slug as string : name)
    const taken = new Set(mine.map((r) => r.slug))
    let slug = base
    if (taken.has(slug) && !(input.slug?.trim())) {
      let n = 2
      while (taken.has(`${base}-${n}`)) n += 1
      slug = `${base}-${n}`
    }
    if (taken.has(slug)) throw new CollectionConflictError("slug already used by this shop")
    const now = new Date().toISOString()
    const row: CollectionRow = {
      id: crypto.randomUUID(),
      sellerId,
      name,
      slug,
      description: cleanText(input.description),
      imageUrl: cleanText(input.imageUrl),
      visibility: input.visibility ?? "draft",
      position: mine.length,
      startsAt: null,
      endsAt: null,
      createdAt: now,
    }
    this.rows.set(row.id, row)
    this.members.set(row.id, [])
    return toDto(row, [])
  }

  async updateCollection(
    sellerId: string,
    id: string,
    patch: UpdateCollectionInput,
  ): Promise<CollectionDto | null> {
    const row = this.rows.get(id)
    if (!row || row.sellerId !== sellerId) return null
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (!name) throw new CollectionValidationError("name required")
      if (name.length > 80) throw new CollectionValidationError("name must be 80 characters or fewer")
      row.name = name
    }
    if (patch.slug !== undefined) {
      const slug = patch.slug?.trim() ? slugify(patch.slug as string) : slugify(row.name)
      if (this.owned(sellerId).some((r) => r.id !== id && r.slug === slug)) {
        throw new CollectionConflictError("slug already used by this shop")
      }
      row.slug = slug
    }
    if (patch.description !== undefined) row.description = cleanText(patch.description)
    if (patch.imageUrl !== undefined) row.imageUrl = cleanText(patch.imageUrl)
    if (patch.visibility !== undefined) row.visibility = patch.visibility
    if (patch.position !== undefined) {
      if (!Number.isInteger(patch.position) || patch.position < 0) {
        throw new CollectionValidationError("position must be a whole number >= 0")
      }
      row.position = patch.position
    }
    const startsAt = patch.startsAt !== undefined ? parseMoment(patch.startsAt, "startsAt") : null
    const endsAt = patch.endsAt !== undefined ? parseMoment(patch.endsAt, "endsAt") : null
    const nextStart = startsAt ?? (row.startsAt ? new Date(row.startsAt) : null)
    const nextEnd = endsAt ?? (row.endsAt ? new Date(row.endsAt) : null)
    if (nextStart && nextEnd && nextEnd.getTime() <= nextStart.getTime()) {
      throw new CollectionValidationError("endsAt must be after startsAt")
    }
    if (patch.startsAt !== undefined) row.startsAt = startsAt ? startsAt.toISOString() : null
    if (patch.endsAt !== undefined) row.endsAt = endsAt ? endsAt.toISOString() : null
    return toDto(row, this.members.get(row.id) ?? [])
  }

  async deleteCollection(sellerId: string, id: string): Promise<boolean> {
    const row = this.rows.get(id)
    if (!row || row.sellerId !== sellerId) return false
    this.rows.delete(id)
    this.members.delete(id)
    return true
  }

  async setCollectionProducts(
    sellerId: string,
    id: string,
    productIds: string[],
  ): Promise<CollectionDto | null> {
    const row = this.rows.get(id)
    if (!row || row.sellerId !== sellerId) return null
    if (productIds.length > MAX_COLLECTION_PRODUCTS) {
      throw new CollectionValidationError(`at most ${MAX_COLLECTION_PRODUCTS} products per collection`)
    }
    if (new Set(productIds).size !== productIds.length) {
      throw new CollectionValidationError("duplicate products")
    }
    for (const pid of productIds) {
      if (!this.isOwnProduct(sellerId, pid)) {
        throw new CollectionValidationError(`product not in this shop's catalog: ${pid}`)
      }
    }
    this.members.set(id, [...productIds])
    return toDto(row, productIds)
  }

  async listPublishedBySeller(sellerId: string, now: Date = new Date()): Promise<CollectionDto[]> {
    return this.owned(sellerId)
      .filter((r) => isLive(r, now))
      .map((r) => toDto(r, this.members.get(r.id) ?? []))
  }
}

export class PostgresCollectionsStore implements CollectionsStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  private async dtoFor(
    row: typeof collections.$inferSelect,
    db: PostgresJsDatabase = this.db,
  ): Promise<CollectionDto> {
    const links = await db
      .select({ productId: collectionProducts.productId })
      .from(collectionProducts)
      .where(eq(collectionProducts.collectionId, row.id))
      .orderBy(asc(collectionProducts.position))
    return {
      id: row.id,
      sellerId: row.sellerId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.imageUrl,
      visibility: row.visibility,
      position: row.position,
      startsAt: row.startsAt ? row.startsAt.toISOString() : null,
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : new Date(0).toISOString(),
      productIds: links.map((l) => l.productId),
    }
  }

  private async owned(sellerId: string): Promise<(typeof collections.$inferSelect)[]> {
    return this.db
      .select()
      .from(collections)
      .where(eq(collections.sellerId, sellerId))
      .orderBy(asc(collections.position))
  }

  async listVendorCollections(sellerId: string): Promise<CollectionDto[]> {
    const rows = await this.owned(sellerId)
    return Promise.all(rows.map((r) => this.dtoFor(r)))
  }

  async createCollection(sellerId: string, input: CreateCollectionInput): Promise<CollectionDto> {
    const name = input.name?.trim()
    if (!name) throw new CollectionValidationError("name required")
    if (name.length > 80) throw new CollectionValidationError("name must be 80 characters or fewer")
    const mine = await this.owned(sellerId)
    if (mine.length >= MAX_COLLECTIONS_PER_SELLER) {
      throw new CollectionValidationError(`at most ${MAX_COLLECTIONS_PER_SELLER} collections per shop`)
    }
    const base = slugify(input.slug?.trim() ? (input.slug as string) : name)
    const taken = new Set(mine.map((r) => r.slug))
    let slug = base
    if (taken.has(slug) && !input.slug?.trim()) {
      let n = 2
      while (taken.has(`${base}-${n}`)) n += 1
      slug = `${base}-${n}`
    }
    if (taken.has(slug)) throw new CollectionConflictError("slug already used by this shop")
    const id = crypto.randomUUID()
    await this.db.insert(collections).values({
      id,
      sellerId,
      name,
      slug,
      description: cleanText(input.description),
      imageUrl: cleanText(input.imageUrl),
      visibility: input.visibility ?? "draft",
      position: mine.length,
    })
    const [row] = await this.db.select().from(collections).where(eq(collections.id, id)).limit(1)
    if (!row) throw new Error("collection insert failed")
    return this.dtoFor(row)
  }

  async updateCollection(
    sellerId: string,
    id: string,
    patch: UpdateCollectionInput,
  ): Promise<CollectionDto | null> {
    const [row] = await this.db.select().from(collections).where(eq(collections.id, id)).limit(1)
    if (!row || row.sellerId !== sellerId) return null
    const set: Partial<typeof collections.$inferInsert> = {}
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (!name) throw new CollectionValidationError("name required")
      if (name.length > 80) throw new CollectionValidationError("name must be 80 characters or fewer")
      set.name = name
    }
    if (patch.slug !== undefined) {
      const slug = patch.slug?.trim() ? slugify(patch.slug as string) : slugify((set.name ?? row.name) as string)
      const clash = await this.db
        .select({ id: collections.id })
        .from(collections)
        .where(and(eq(collections.sellerId, sellerId), eq(collections.slug, slug)))
        .limit(1)
      if (clash.some((c) => c.id !== id)) throw new CollectionConflictError("slug already used by this shop")
      set.slug = slug
    }
    if (patch.description !== undefined) set.description = cleanText(patch.description)
    if (patch.imageUrl !== undefined) set.imageUrl = cleanText(patch.imageUrl)
    if (patch.visibility !== undefined) set.visibility = patch.visibility
    if (patch.position !== undefined) {
      if (!Number.isInteger(patch.position) || patch.position < 0) {
        throw new CollectionValidationError("position must be a whole number >= 0")
      }
      set.position = patch.position
    }
    const startsAt = patch.startsAt !== undefined ? parseMoment(patch.startsAt, "startsAt") : null
    const endsAt = patch.endsAt !== undefined ? parseMoment(patch.endsAt, "endsAt") : null
    const nextStart = startsAt ?? row.startsAt
    const nextEnd = endsAt ?? row.endsAt
    if (nextStart && nextEnd && nextEnd.getTime() <= nextStart.getTime()) {
      throw new CollectionValidationError("endsAt must be after startsAt")
    }
    if (patch.startsAt !== undefined) set.startsAt = startsAt
    if (patch.endsAt !== undefined) set.endsAt = endsAt
    if (Object.keys(set).length > 0) {
      await this.db.update(collections).set(set).where(eq(collections.id, id))
    }
    const [fresh] = await this.db.select().from(collections).where(eq(collections.id, id)).limit(1)
    if (!fresh) return null
    return this.dtoFor(fresh)
  }

  async deleteCollection(sellerId: string, id: string): Promise<boolean> {
    const [row] = await this.db.select({ sellerId: collections.sellerId }).from(collections).where(eq(collections.id, id)).limit(1)
    if (!row || row.sellerId !== sellerId) return false
    await this.db.transaction(async (tx) => {
      await tx.delete(collectionProducts).where(eq(collectionProducts.collectionId, id))
      await tx.delete(collections).where(eq(collections.id, id))
    })
    return true
  }

  async setCollectionProducts(
    sellerId: string,
    id: string,
    productIds: string[],
  ): Promise<CollectionDto | null> {
    const [row] = await this.db.select().from(collections).where(eq(collections.id, id)).limit(1)
    if (!row || row.sellerId !== sellerId) return null
    if (productIds.length > MAX_COLLECTION_PRODUCTS) {
      throw new CollectionValidationError(`at most ${MAX_COLLECTION_PRODUCTS} products per collection`)
    }
    if (new Set(productIds).size !== productIds.length) {
      throw new CollectionValidationError("duplicate products")
    }
    if (productIds.length > 0) {
      const { products, offers } = await import("@alkemart/db")
      const prodRows = await this.db
        .select({ id: products.id, sellerId: products.sellerId })
        .from(products)
        .where(inArray(products.id, productIds))
      const byId = new Map(prodRows.map((p) => [p.id, p]))
      const offerRows = await this.db
        .select({ productId: offers.productId })
        .from(offers)
        .where(and(eq(offers.sellerId, sellerId), inArray(offers.productId, productIds)))
      const offered = new Set(offerRows.map((o) => o.productId))
      for (const pid of productIds) {
        const prod = byId.get(pid)
        if (!prod || (prod.sellerId !== sellerId && !offered.has(pid))) {
          throw new CollectionValidationError(`product not in this shop's catalog: ${pid}`)
        }
      }
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(collectionProducts).where(eq(collectionProducts.collectionId, id))
      if (productIds.length > 0) {
        await tx.insert(collectionProducts).values(
          productIds.map((productId, i) => ({
            id: crypto.randomUUID(),
            collectionId: id,
            productId,
            position: i,
          })),
        )
      }
    })
    const [fresh] = await this.db.select().from(collections).where(eq(collections.id, id)).limit(1)
    if (!fresh) return null
    return this.dtoFor(fresh)
  }

  async listPublishedBySeller(sellerId: string, now: Date = new Date()): Promise<CollectionDto[]> {
    const rows = await this.owned(sellerId)
    const live = rows.filter((r) => isLive(r, now))
    return Promise.all(live.map((r) => this.dtoFor(r)))
  }
}
