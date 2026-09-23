import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { GuideValidationError } from "../../guides"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const Text = (max: number) => z.string().trim().min(1).max(max)

const CreateBody = z.object({
  slug: z.string().trim().min(1).max(80),
  title: Text(140),
  excerpt: Text(300),
  author: Text(120),
})

const SectionPick = z.object({
  label: z.string().trim().max(120).optional().nullable(),
  categoryHandle: z.string().trim().min(1).max(80).optional().nullable(),
  query: z.string().trim().min(1).max(120).optional().nullable(),
  limit: z.number().int().min(1).max(8).optional().nullable(),
})

const PatchBody = z
  .object({
    title: Text(140).optional(),
    excerpt: Text(300).optional(),
    author: Text(120).optional(),
    sections: z
      .array(
        z.object({
          heading: Text(140),
          body: Text(5000),
          picks: z.array(SectionPick).max(3).optional().nullable(),
        }),
      )
      .max(20)
      .optional(),
    relatedGuides: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
    refreshAfter: z.string().trim().min(1).max(64).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

function mapGuideError(err: unknown): never {
  if (err instanceof GuideValidationError) {
    throw new HTTPException(400, { message: err.message })
  }
  throw err
}

/**
 * Phase 6E — editorial workflow. Drafts are cheap and private; publishing
 * requires at least one section. Revisions bump on every mutation for the
 * refresh rota; deleting a draft cleans up inbound related links.
 */
export const adminGuides = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const raw = c.req.query("status")
    const status = raw === "draft" || raw === "published" ? raw : undefined
    return c.json({ items: await c.get("guides").listGuides(status) })
  })
  .post("/", async (c) => {
    const parsed = CreateBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const guide = await c.get("guides").createGuide(parsed.data)
      return c.json({ guide }, 201)
    } catch (err) {
      mapGuideError(err)
    }
  })
  .get("/:slug", async (c) => {
    const guide = await c.get("guides").getGuide(c.req.param("slug"))
    if (!guide) throw new HTTPException(404, { message: "guide not found" })
    return c.json({ guide })
  })
  .patch("/:slug", async (c) => {
    const parsed = PatchBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const guide = await c.get("guides").updateGuide(c.req.param("slug"), {
        ...parsed.data,
        sections: parsed.data.sections?.map((s) => ({
          heading: s.heading,
          body: s.body,
          picks: (s.picks ?? []).map((p) => ({
            label: p.label ?? null,
            categoryHandle: p.categoryHandle ?? null,
            query: p.query ?? null,
            limit: p.limit ?? 4,
          })),
        })),
      })
      if (!guide) throw new HTTPException(404, { message: "guide not found" })
      return c.json({ guide })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapGuideError(err)
    }
  })
  .post("/:slug/publish", async (c) => {
    try {
      const guide = await c.get("guides").publishGuide(c.req.param("slug"))
      if (!guide) throw new HTTPException(404, { message: "guide not found" })
      return c.json({ guide })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapGuideError(err)
    }
  })
  .post("/:slug/unpublish", async (c) => {
    const guide = await c.get("guides").unpublishGuide(c.req.param("slug"))
    if (!guide) throw new HTTPException(404, { message: "guide not found" })
    return c.json({ guide })
  })
  .delete("/:slug", async (c) => {
    try {
      const deleted = await c.get("guides").deleteGuide(c.req.param("slug"))
      if (!deleted) throw new HTTPException(404, { message: "guide not found" })
      return c.json({ deleted: true })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapGuideError(err)
    }
  })
