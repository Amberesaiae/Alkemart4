import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { vendorsTable } from "./vendors";

export const IMAGE_TARGET_TYPES = ["product", "vendor_logo", "vendor_banner", "homepage_section"] as const;
export type ImageTargetType = (typeof IMAGE_TARGET_TYPES)[number];

export const IMAGE_STATUSES = ["pending", "approved", "rejected"] as const;
export type ImageStatus = (typeof IMAGE_STATUSES)[number];

/**
 * Tracks every image uploaded through the moderation pipeline. Approved-image
 * lookup for rendering is done by (targetType, targetId) rather than a
 * denormalized column on products/vendors/homepage_sections, so a new upload
 * can supersede an old one without a migration touching those tables.
 */
export const imagesTable = pgTable("images", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  vendorId: integer("vendor_id").references(() => vendorsTable.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull().$type<ImageTargetType>(),
  targetId: integer("target_id"),
  objectPath: text("object_path").notNull(),
  status: text("status").notNull().default("pending").$type<ImageStatus>(),
  rejectionReason: text("rejection_reason"),
  width: integer("width"),
  height: integer("height"),
  sizeBytes: integer("size_bytes"),
  contentType: text("content_type"),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertImageSchema = createInsertSchema(imagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertImage = z.infer<typeof insertImageSchema>;
export type ImageRecord = typeof imagesTable.$inferSelect;

/**
 * Server-issued record of every presigned upload URL granted. Registration
 * (`POST /images`) must be able to prove the `objectPath` it's asked to
 * process was actually issued to the calling user — never trust a
 * client-supplied `objectPath` on its own, since that path is later
 * downloaded, inspected, and potentially deleted (on rejection). Consumed
 * (or expired/foreign) intents are rejected at registration time.
 */
export const imageUploadIntentsTable = pgTable("image_upload_intents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  objectPath: text("object_path").notNull().unique(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ImageUploadIntentRecord = typeof imageUploadIntentsTable.$inferSelect;
