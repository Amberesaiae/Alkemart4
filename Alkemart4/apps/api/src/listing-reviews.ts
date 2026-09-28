import { listingReviews, platformSettings } from "@alkemart/db"
import type { ReviewMode, ReviewReason } from "@alkemart/domain"
import { desc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/**
 * Listing review history + operator settings (0038). Append-only history:
 * the latest row per product is its current review state; nothing is
 * rewritten, so admins can always see who decided what and why.
 */
export type ListingReviewRow = {
  id: string
  productId: string
  decision: "submitted" | "approve" | "reject" | "request_changes" | "escalate"
  reviewer: "seller" | "system" | "ai" | "admin"
  reviewerId: string | null
  reasons: ReviewReason[]
  note: string | null
  model: string | null
  confidence: number | null
  createdAt: Date
}

export type NewListingReview = Omit<ListingReviewRow, "id" | "createdAt" | "reviewerId" | "note" | "model" | "confidence" | "reasons"> &
  Partial<Pick<ListingReviewRow, "reviewerId" | "note" | "model" | "confidence" | "reasons">>

export interface ListingReviewStore {
  record(r: NewListingReview): Promise<ListingReviewRow>
  history(productId: string): Promise<ListingReviewRow[]>
  /** Latest review per product (for lists). */
  latest(productIds: string[]): Promise<Map<string, ListingReviewRow>>
  getReviewMode(): Promise<ReviewMode>
  setReviewMode(mode: ReviewMode, by: string): Promise<void>
}

/** Trust by default: clean listings go live, flagged ones wait for a person. */
export const DEFAULT_REVIEW_MODE: ReviewMode = "trust"
const MODE_KEY = "listing_review_mode"
const isMode = (v: unknown): v is ReviewMode => v === "trust" || v === "manual" || v === "assist" || v === "auto"

export class InMemoryListingReviewStore implements ListingReviewStore {
  private rows: ListingReviewRow[] = []
  private mode: ReviewMode = DEFAULT_REVIEW_MODE

  async record(r: NewListingReview) {
    const row: ListingReviewRow = {
      id: crypto.randomUUID(),
      reviewerId: null,
      note: null,
      model: null,
      confidence: null,
      reasons: [],
      ...r,
      createdAt: new Date(Date.now() + this.rows.length), // strictly increasing within a burst
    }
    this.rows.push(row)
    return { ...row }
  }
  async history(productId: string) {
    return this.rows.filter((r) => r.productId === productId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
  async latest(productIds: string[]) {
    const out = new Map<string, ListingReviewRow>()
    for (const r of this.rows) {
      if (!productIds.includes(r.productId)) continue
      const cur = out.get(r.productId)
      if (!cur || r.createdAt > cur.createdAt) out.set(r.productId, r)
    }
    return out
  }
  async getReviewMode() {
    return this.mode
  }
  async setReviewMode(mode: ReviewMode) {
    this.mode = mode
  }
}

type Row = typeof listingReviews.$inferSelect
const toRow = (r: Row): ListingReviewRow => ({
  id: r.id,
  productId: r.productId,
  decision: r.decision as ListingReviewRow["decision"],
  reviewer: r.reviewer as ListingReviewRow["reviewer"],
  reviewerId: r.reviewerId,
  reasons: (r.reasons ?? []) as ReviewReason[],
  note: r.note,
  model: r.model,
  confidence: r.confidence,
  createdAt: r.createdAt,
})

export class PostgresListingReviewStore implements ListingReviewStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async record(r: NewListingReview) {
    const [row] = await this.db
      .insert(listingReviews)
      .values({
        id: crypto.randomUUID(),
        productId: r.productId,
        decision: r.decision,
        reviewer: r.reviewer,
        reviewerId: r.reviewerId ?? null,
        reasons: r.reasons ?? [],
        note: r.note ?? null,
        model: r.model ?? null,
        confidence: r.confidence ?? null,
      })
      .returning()
    if (!row) throw new Error("failed to record listing review")
    return toRow(row)
  }
  async history(productId: string) {
    const rows = await this.db.select().from(listingReviews).where(eq(listingReviews.productId, productId)).orderBy(desc(listingReviews.createdAt))
    return rows.map(toRow)
  }
  async latest(productIds: string[]) {
    const out = new Map<string, ListingReviewRow>()
    if (!productIds.length) return out
    const rows = await this.db
      .select()
      .from(listingReviews)
      .where(inArray(listingReviews.productId, productIds))
      .orderBy(desc(listingReviews.createdAt))
    for (const r of rows) if (!out.has(r.productId)) out.set(r.productId, toRow(r))
    return out
  }
  async getReviewMode() {
    const [row] = await this.db.select().from(platformSettings).where(eq(platformSettings.key, MODE_KEY)).limit(1)
    return isMode(row?.value) ? row.value : DEFAULT_REVIEW_MODE
  }
  async setReviewMode(mode: ReviewMode, by: string) {
    await this.db
      .insert(platformSettings)
      .values({ key: MODE_KEY, value: mode, updatedBy: by })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value: mode, updatedBy: by, updatedAt: new Date() } })
  }
}
