import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { ContentRevisionConflict } from "../../homepage-content"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const id = z.string().trim().min(1).max(80)
const href = z.string().trim().min(1).max(500).refine((value) => value.startsWith("/") && !value.startsWith("//"), "links must be internal paths")
const imageUrl = z.string().trim().max(1000).refine((value) => value === "" || value.startsWith("/") || value.startsWith("https://"), "images must use HTTPS or an internal path").optional()
const optionalText = z.string().trim().max(240).optional()
const subtitle = z.string().trim().max(160).optional()
const visibility = {
  visible: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
}
const tile = z.object({
  id,
  title: z.string().trim().min(1).max(80),
  eyebrow: z.string().trim().max(40).optional(),
  body: optionalText,
  imageUrl,
  href,
})
const categoryTile = z.object({
  categoryId: z.string().trim().min(1).max(100),
  imageUrl,
  focalPoint: z.string().trim().max(40).optional(),
  label: z.string().trim().max(60).optional(),
  eyebrow: z.string().trim().max(40).optional(),
  badge: z.string().trim().max(20).optional(),
  slot: z.enum(["feature", "standard"]).optional(),
})
const link = z.object({ label: z.string().trim().min(1).max(40), href })
const section = z.discriminatedUnion("type", [
  z.object({
    id,
    type: z.literal("promo_hero"),
    eyebrow: z.string().trim().max(40).optional(),
    title: z.string().trim().min(1).max(100),
    subtitle,
    body: optionalText,
    imageUrl,
    action: link.optional(),
    theme: z.enum(["white", "gold", "black"]),
    layout: z.enum(["split", "band"]).optional(),
    ...visibility,
  }),
  z.object({
    id,
    type: z.literal("promo_grid"),
    title: z.string().trim().max(100).optional(),
    subtitle,
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    theme: z.enum(["white", "gold", "black"]),
    variant: z.enum(["cards", "bento"]).optional(),
    tiles: z.array(tile).min(1).max(8),
    ...visibility,
  }),
  z.object({
    id,
    type: z.literal("category_grid"),
    title: z.string().trim().min(1).max(100),
    subtitle,
    columns: z.union([z.literal(4), z.literal(6), z.literal(8)]),
    variant: z.enum(["tiles", "mosaic", "rail", "banner"]).optional(),
    ratio: z.enum(["square", "landscape", "wide", "ultrawide"]).optional(),
    showAllLink: z.boolean().optional(),
    tiles: z.array(categoryTile).max(16).default([]),
    // Accepted for editors still on the pre-banner payload; migrated on read.
    categoryIds: z.array(z.string().trim().min(1).max(100)).max(16).optional(),
    ...visibility,
  }),
  z.object({
    id,
    type: z.literal("product_shelf"),
    title: z.string().trim().min(1).max(100),
    subtitle,
    source: z.enum(["featured", "latest", "category", "manual", "most_ordered", "trending", "daypart", "near_me"]),
    categoryId: z.string().trim().max(100).optional(),
    productIds: z.array(z.string().trim().min(1).max(100)).max(12).optional(),
    daypartCategoryIds: z
      .object({
        breakfast: z.string().trim().max(100).optional(),
        lunch: z.string().trim().max(100).optional(),
        supper: z.string().trim().max(100).optional(),
        late: z.string().trim().max(100).optional(),
      })
      .optional(),
    limit: z.union([z.literal(4), z.literal(8), z.literal(12)]),
    layout: z.enum(["grid", "carousel"]).optional(),
    ...visibility,
  }),
  z.object({
    id,
    type: z.literal("promo_band"),
    eyebrow: z.string().trim().max(40).optional(),
    title: z.string().trim().min(1).max(100),
    body: optionalText,
    imageUrl,
    action: link.optional(),
    secondaryAction: link.optional(),
    theme: z.enum(["white", "gold", "black"]),
    ...visibility,
  }),
  z.object({
    id,
    type: z.literal("countdown_banner"),
    eyebrow: z.string().trim().max(40).optional(),
    title: z.string().trim().min(1).max(100),
    body: optionalText,
    countdownTo: z.string().datetime(),
    expiredLabel: z.string().trim().max(60).optional(),
    imageUrl,
    action: link.optional(),
    theme: z.enum(["white", "gold", "black"]),
    ...visibility,
  }),
  z.object({
    id,
    type: z.literal("marquee"),
    items: z.array(z.object({
      id,
      label: z.string().trim().min(1).max(80),
      href: href.optional(),
    })).min(1).max(8),
    theme: z.enum(["white", "gold", "black"]),
    animated: z.boolean().optional(),
    speed: z.enum(["slow", "normal"]).optional(),
    ...visibility,
  }),
  z.object({
    id,
    type: z.literal("deal_rail"),
    title: z.string().trim().min(1).max(100),
    subtitle,
    eyebrow: z.string().trim().max(40).optional(),
    badge: z.string().trim().max(20).optional(),
    source: z.enum(["featured", "latest", "category", "manual", "most_ordered", "trending", "daypart", "near_me"]),
    categoryId: z.string().trim().max(100).optional(),
    productIds: z.array(z.string().trim().min(1).max(100)).max(12).optional(),
    limit: z.union([z.literal(4), z.literal(8), z.literal(12)]),
    countdownTo: z.string().datetime().optional(),
    ...visibility,
  }),
  z.object({
    id,
    type: z.literal("value_grid"),
    title: z.string().trim().max(100).optional(),
    subtitle,
    items: z.array(z.object({ id, title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(180) })).min(2).max(4),
    ...visibility,
  }),
  z.object({
    id,
    type: z.literal("store_rail"),
    title: z.string().trim().min(1).max(100),
    subtitle,
    source: z.enum(["top_rated", "fastest", "newest", "near_me", "manual"]),
    sellerHandles: z.array(z.string().trim().min(1).max(100)).max(12).optional(),
    limit: z.union([z.literal(4), z.literal(8), z.literal(12)]),
    layout: z.enum(["grid", "carousel"]).optional(),
    ...visibility,
  }),
])
const saveBody = z.object({ revision: z.number().int().positive(), sections: z.array(section).max(24) }).superRefine((value, context) => {
  const ids = value.sections.map((item) => item.id)
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "section IDs must be unique", path: ["sections"] })
  value.sections.forEach((item, index) => {
    if ((item.type === "product_shelf" || item.type === "deal_rail") && item.source === "category" && !item.categoryId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "categoryId is required for a category shelf", path: ["sections", index, "categoryId"] })
    }
    if ((item.type === "product_shelf" || item.type === "deal_rail") && item.source === "manual" && !(item.productIds ?? []).length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "add at least one product ID for a manual shelf", path: ["sections", index, "productIds"] })
    }
    if ((item.type === "product_shelf" || item.type === "deal_rail") && item.source === "daypart") {
      const parts = item.type === "product_shelf" ? (item.daypartCategoryIds ?? {}) : {}
      if (Object.values(parts).filter(Boolean).length === 0) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "pick a category for at least one part of the day", path: ["sections", index, "daypartCategoryIds"] })
      }
    }
    if (item.type === "store_rail" && item.source === "manual" && !(item.sellerHandles ?? []).length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "add at least one shop for a manual store rail", path: ["sections", index, "sellerHandles"] })
    }
    if (item.type === "category_grid" && !(item.tiles ?? []).length && !(item.categoryIds ?? []).length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "pick at least one category", path: ["sections", index, "tiles"] })
    }
    if (item.startsAt && item.endsAt && item.startsAt >= item.endsAt) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "section end must be after section start", path: ["sections", index, "endsAt"] })
    }
  })
})
const publishBody = z.object({ revision: z.number().int().positive(), unpublishAt: z.string().datetime().nullable().optional() })
const scheduleBody = publishBody.extend({ publishAt: z.string().datetime() })

function conflict(error: unknown): never {
  if (error instanceof ContentRevisionConflict) throw new HTTPException(409, { message: error.message })
  throw error
}

export const adminHomepage = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => c.json(await c.get("homepage").getEditor()))
  .put("/draft", async (c) => {
    const parsed = saveBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "invalid homepage" })
    try {
      const page = await c.get("homepage").saveDraft({ expectedRevision: parsed.data.revision, sections: parsed.data.sections })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "homepage.draft_saved",
        targetType: "content_page",
        targetId: "homepage",
        detail: { revision: page.revision, sections: page.sections.length },
      })
      return c.json(page)
    } catch (error) { conflict(error) }
  })
  .post("/publish", async (c) => {
    const parsed = publishBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid publish request" })
    try {
      const page = await c.get("homepage").publish({
        expectedRevision: parsed.data.revision,
        unpublishAt: parsed.data.unpublishAt ? new Date(parsed.data.unpublishAt) : null,
      })
      await c.get("auditLog").log({ adminUserId: c.get("auth").userId, action: "homepage.published", targetType: "content_page", targetId: "homepage", detail: { revision: page.revision } })
      return c.json(page)
    } catch (error) { conflict(error) }
  })
  .post("/schedule", async (c) => {
    const parsed = scheduleBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid schedule request" })
    const publishAt = new Date(parsed.data.publishAt)
    if (publishAt <= new Date()) throw new HTTPException(400, { message: "publishAt must be in the future" })
    if (parsed.data.unpublishAt && new Date(parsed.data.unpublishAt) <= publishAt) throw new HTTPException(400, { message: "unpublishAt must be after publishAt" })
    try {
      const page = await c.get("homepage").schedule({
        expectedRevision: parsed.data.revision,
        publishAt,
        unpublishAt: parsed.data.unpublishAt ? new Date(parsed.data.unpublishAt) : null,
      })
      await c.get("auditLog").log({ adminUserId: c.get("auth").userId, action: "homepage.scheduled", targetType: "content_page", targetId: "homepage", detail: { revision: page.revision, publishAt: parsed.data.publishAt } })
      return c.json(page)
    } catch (error) { conflict(error) }
  })
