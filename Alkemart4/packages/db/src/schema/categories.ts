import {
  type AnyPgColumn,
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
} from "drizzle-orm/pg-core"

/** Blueprint Phase 1A — taxonomy lifecycle (ADR-003 companion for platform tree). */
export const taxonomyStatusEnum = pgEnum("taxonomy_status", [
  "proposed",
  "active",
  "deprecated",
])

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  parentId: text("parent_id").references((): AnyPgColumn => categories.id),
  rank: integer("rank").notNull().default(0),
  isNav: boolean("is_nav").notNull().default(true),
  // ── Phase 1A additions (all nullable/backfilled; legacy readers unaffected) ──
  /** Stable machine code, e.g. `phones.smartphones`. */
  code: text("code"),
  /** Buyer-facing override; falls back to `name` when null. */
  displayName: text("display_name"),
  /** URL slug; falls back to `handle` when null. */
  slug: text("slug"),
  level: integer("level").notNull().default(0),
  status: taxonomyStatusEnum("status").notNull().default("active"),
  /** False = grouping node, not a browsable landing page. */
  isBrowseable: boolean("is_browseable").notNull().default(true),
  /** False = sellers cannot assign products here (grouping nodes). */
  isAssignable: boolean("is_assignable").notNull().default(true),
  /** False = hidden from nav but reachable (campaign/SEO landings). */
  isNavVisible: boolean("is_nav_visible").notNull().default(true),
  /** Typed-attribute profile governing this node (Phase 1C). */
  attributeProfileId: text("attribute_profile_id"),
  /** Deprecation target — never hard-delete an in-use node. */
  replacementNodeId: text("replacement_node_id").references(
    (): AnyPgColumn => categories.id,
  ),
  sortOrder: integer("sort_order").notNull().default(0),
  version: integer("version").notNull().default(1),
})
