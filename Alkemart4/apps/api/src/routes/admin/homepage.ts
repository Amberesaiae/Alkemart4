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
    variant: z.enum(["tiles", "mosaic", "rail"]).optional(),
    showAllLink: z.boolean().optional(),
    categoryIds: z.array(z.string().trim().min(1).max(100)).max(16),
    ...visibility,
  }),
  z.object({
    id,
    type: z.literal("product_shelf"),
    title: z.string().trim().min(1).max(100),
    subtitle,
    source: z.enum(["featured", "latest", "category", "manual"]),
    categoryId: z.string().trim().max(100).optional(),
    productIds: z.array(z.string().trim().min(1).max(100)).max(12).optional(),
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
    type: z.literal("value_grid"),
    title: z.string().trim().max(100).optional(),
    subtitle,
    items: z.array(z.object({ id, title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(180) })).min(2).max(4),
    ...visibility,
  }),
])
const saveBody = z.object({ revision: z.number().int().positive(), sections: z.array(section).max(24) }).superRefine((value, context) => {
  const ids = value.sections.map((item) => item.id)
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "section IDs must be unique", path: ["sections"] })
  value.sections.forEach((item, index) => {
    if (item.type === "product_shelf" && item.source === "category" && !item.categoryId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "categoryId is required for a category shelf", path: ["sections", index, "categoryId"] })
    }
    if (item.type === "product_shelf" && item.source === "manual" && !(item.productIds ?? []).length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "add at least one product ID for a manual shelf", path: ["sections", index, "productIds"] })
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
