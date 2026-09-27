import { boolean, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"
import { sellers } from "./sellers"

/** A TikTok / Instagram / YouTube link on a listing (0047). Embeds are rebuilt from platform + id. */
export const productVideos = pgTable("product_videos", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  platform: text("platform").$type<"youtube" | "tiktok" | "instagram">().notNull(),
  videoId: text("video_id").notNull(),
  url: text("url").notNull(),
  status: text("status").$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
  featured: boolean("featured").notNull().default(false),
  rejectReason: text("reject_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
})

/** Photo spec reads per seller per month (0047). */
export const listingAssistUsage = pgTable(
  "listing_assist_usage",
  {
    sellerId: text("seller_id")
      .notNull()
      .references(() => sellers.id),
    period: text("period").notNull(),
    photoReads: integer("photo_reads").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.sellerId, t.period] })],
)
