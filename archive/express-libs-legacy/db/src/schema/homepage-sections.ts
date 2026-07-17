import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const SECTION_TYPES = [
  "announcement_yellow",
  "hero",
  "product_rail",
  "feature_grid",
  "deals_grid",
  "category_row",
  "bento_grid",
  "video_grid",
  "hero_split",
  "express_band",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const homepageSectionsTable = pgTable("homepage_sections", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().$type<SectionType>(),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(false),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertHomepageSectionSchema = createInsertSchema(homepageSectionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHomepageSection = z.infer<typeof insertHomepageSectionSchema>;
export type HomepageSection = typeof homepageSectionsTable.$inferSelect;
