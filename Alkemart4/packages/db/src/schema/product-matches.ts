import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { products } from "./products"

/**
 * Blueprint Phase 1D — product-match workflow (ADR-002).
 * Candidates are proposed by rules/similarity and confirmed by review.
 * No auto-merge: rows are evidence + decisions, never silent merges.
 */
export const matchCandidateStatusEnum = pgEnum("match_candidate_status", [
  "proposed",
  "confirmed",
  "rejected",
])

export const productMatchCandidates = pgTable("product_match_candidates", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  candidateProductId: text("candidate_product_id")
    .notNull()
    .references(() => products.id),
  /** `rules` | `similarity` | `seller_claim` | `admin_claim`. */
  source: text("source").notNull(),
  /** signal payload: matched fields, scores (informational only). */
  evidence: jsonb("evidence").$type<Record<string, unknown>>(),
  status: matchCandidateStatusEnum("status").notNull().default("proposed"),
  /** Reviewer identity (admin/seller id) — null while proposed. */
  reviewerId: text("reviewer_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
