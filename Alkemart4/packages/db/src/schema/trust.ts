import { bigint, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { offers } from "./offers"
import { sellers } from "./sellers"

/**
 * Blueprint Phase 3 — decomposed seller verification (Doc 04/09) and
 * price integrity history. Every badge has a machine id, evidence source,
 * issue/expiry dates, and revocation. "Verified" never implies more than
 * what was checked.
 */
export const verificationKindEnum = pgEnum("verification_kind", [
  "contact",
  "identity",
  "business",
  "brand_auth",
  "fulfillment_proven",
])

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "verified",
  "revoked",
  "expired",
])

export const sellerVerifications = pgTable("seller_verifications", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  kind: verificationKindEnum("kind").notNull(),
  status: verificationStatusEnum("status").notNull().default("pending"),
  /** Evidence reference (document id, order aggregate, domain check). */
  evidence: text("evidence"),
  issuedBy: text("issued_by"),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokeReason: text("revoke_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

/** Append-only price log per offer (compare-at provenance + anomaly review). */
export const offerPriceHistory = pgTable("offer_price_history", {
  id: text("id").primaryKey(),
  offerId: text("offer_id")
    .notNull()
    .references(() => offers.id),
  oldPricePesewas: bigint("old_price_pesewas", { mode: "bigint" }).notNull(),
  newPricePesewas: bigint("new_price_pesewas", { mode: "bigint" }).notNull(),
  changedBy: text("changed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
