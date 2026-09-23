import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { categories } from "./categories"
import { sellers } from "./sellers"

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "proposed",
  "published",
  "rejected",
])

/** Blueprint Phase 1B — product identity confidence (ADR-002). */
export const identityConfidenceEnum = pgEnum("identity_confidence", [
  "identified",
  "matched",
  "seller_specific",
])

/** Canonical catalog content. Price and stock live on offers, never here. */
export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  /** URL handle for /product/{slug}-{id}. Backfilled from titles (0027);
   * the trailing id stays authoritative so slugs never break links. */
  slug: text("slug"),
  status: productStatusEnum("status").notNull().default("draft"),
  primaryCategoryId: text("primary_category_id")
    .notNull()
    .references(() => categories.id),
  sellerId: text("seller_id").references(() => sellers.id),
  /** Vendor-supplied image URL. Uploads are not on Workers yet; a pasted URL is honest media. */
  imageUrl: text("image_url"),
  /** Structured facts about the item ({label, value}[]), not variant axes. */
  attributes: jsonb("attributes").$type<{ label: string; value: string }[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // ── Phase 1B additions (nullable; legacy rows read as seller_specific) ──
  /** Manufacturer / product brand — the ONLY source for JSON-LD Brand. */
  brand: text("brand"),
  /** Model / product family, e.g. `Spark 20`. */
  model: text("model"),
  gtin: text("gtin"),
  mpn: text("mpn"),
  manufacturer: text("manufacturer"),
  /** Governed product type, e.g. `smartphone`. */
  productType: text("product_type"),
  identityConfidence: identityConfidenceEnum("identity_confidence").notNull().default(
    "seller_specific",
  ),
  /** How confidence was established (rule id, reviewer, evidence refs). */
  identityProvenance: jsonb("identity_provenance").$type<Record<string, unknown>>(),
  },
  (table) => [
    // Listing queries filter by status (0028).
    index("products_status_created_idx").on(table.status, table.createdAt),
  ],
)

export const productVariants = pgTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    sku: text("sku").unique(),
    title: text("title"),
    // ── Phase 1B additions ──
    /** Variant-specific image; falls back to product image when null. */
    imageUrl: text("image_url"),
    weightGrams: integer("weight_grams"),
    /** Variant-level identifier (GTIN/SKU override) when known. */
    gtin: text("gtin"),
  },
  (table) => [
    // Slice loaders filter variants by product; FK columns are NOT
    // auto-indexed by Postgres (0028).
    index("product_variants_product_id_idx").on(table.productId),
  ],
)
