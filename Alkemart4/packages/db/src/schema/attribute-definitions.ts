import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { products } from "./products"

/**
 * Blueprint Phase 1C — typed attributes (blueprint Doc 02).
 * Free-form `products.attributes` JSON remains the migration/input layer;
 * facets and comparison read ONLY these typed values.
 */
export const attributeTypeEnum = pgEnum("attribute_type", [
  "text",
  "number",
  "boolean",
  "option",
  "multi_option",
])

/** Does this attribute mean the same thing everywhere, or only in its profile? */
export const attributeScopeEnum = pgEnum("attribute_scope", ["universal", "profile"])

export const attributeDefinitions = pgTable("attribute_definitions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  type: attributeTypeEnum("type").notNull(),
  /** Unit family key, e.g. `storage`, `memory`, `screen`. */
  unitFamily: text("unit_family"),
  /** Allowed option values for option/multi_option types. */
  allowedValues: jsonb("allowed_values").$type<string[]>(),
  filterable: boolean("filterable").notNull().default(false),
  searchable: boolean("searchable").notNull().default(false),
  required: boolean("required").notNull().default(false),
  /** True = this attribute may be a variant axis for its product type. */
  variantAxis: boolean("variant_axis").notNull().default(false),
  visibleOnCard: boolean("visible_on_card").notNull().default(false),
  visibleOnPdp: boolean("visible_on_pdp").notNull().default(true),
  /**
   * `universal` survives a category change; `profile` is dropped where the
   * destination does not declare it (migration 0033). Defaults to `profile`,
   * the conservative choice — a wrongly-kept filter silently zeroes results.
   */
  scope: attributeScopeEnum("scope").notNull().default("profile"),
})

/** Named per-category sets of definitions, e.g. `phones-v1`. */
export const attributeProfiles = pgTable("attribute_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Category node this profile governs (see categories.attributeProfileId). */
  categoryId: text("category_id"),
  version: integer("version").notNull().default(1),
})

export const profileAttributes = pgTable(
  "profile_attributes",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => attributeProfiles.id),
    definitionId: text("definition_id")
      .notNull()
      .references(() => attributeDefinitions.id),
    position: integer("position").notNull().default(0),
    /** Profile-level requiredness override. */
    required: boolean("required").notNull().default(false),
  },
  (table) => [
    uniqueIndex("profile_attributes_uidx").on(
      table.profileId,
      table.definitionId,
    ),
  ],
)

/** One typed value row per product × definition. Exactly one value column set. */
export const productAttributeValues = pgTable(
  "product_attribute_values",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    definitionId: text("definition_id")
      .notNull()
      .references(() => attributeDefinitions.id),
    textValue: text("text_value"),
    numberValue: doublePrecision("number_value"),
    booleanValue: boolean("boolean_value"),
    /** option/multi_option selections (validated against allowedValues). */
    optionValues: jsonb("option_values").$type<string[]>(),
    /** Unit used for this value, e.g. `GB`. */
    unit: text("unit"),
  },
  (table) => [
    uniqueIndex("product_attribute_values_uidx").on(
      table.productId,
      table.definitionId,
    ),
  ],
)
