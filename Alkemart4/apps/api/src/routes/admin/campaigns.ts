import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import {
  CampaignConflictError,
  CampaignValidationError,
  type CampaignTransition,
} from "../../campaigns"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const Objective = z.enum(["sale", "launch", "clearance", "brand"])
const Status = z.enum(["draft", "review", "scheduled", "live", "ended"])
const Transition = z.enum(["submit", "approve", "publish", "end", "reopen"])
const Moment = z.string().trim().min(1).max(64)
const Text = (max: number) => z.string().trim().min(1).max(max)

const CreateBody = z.object({
  name: Text(120),
  placementCode: z.string().trim().min(1).max(64),
  objective: Objective.optional(),
  priority: z.number().int().min(0).optional(),
  sponsored: z.boolean().optional(),
  termsId: z.string().min(1).optional().nullable(),
  startsAt: Moment.optional().nullable(),
  endsAt: Moment.optional().nullable(),
})

const PatchBody = z
  .object({
    name: Text(120).optional(),
    objective: Objective.optional(),
    placementCode: z.string().trim().min(1).max(64).optional(),
    priority: z.number().int().min(0).optional(),
    sponsored: z.boolean().optional(),
    termsId: z.string().min(1).optional().nullable(),
    startsAt: Moment.optional().nullable(),
    endsAt: Moment.optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

const TermsBody = z.object({
  label: Text(120),
  summary: Text(2000),
  finePrint: z.string().trim().max(5000).optional().nullable(),
  startsAt: Moment.optional().nullable(),
  endsAt: Moment.optional().nullable(),
})

const CreativeBody = z.object({
  slot: z.enum(["desktop", "mobile"]).optional(),
  title: Text(120),
  subtitle: z.string().trim().max(200).optional().nullable(),
  imageUrl: z.string().trim().url().max(2048).optional().nullable(),
  link: z.string().trim().max(2048).optional().nullable(),
})

const ProductsBody = z.object({ productIds: z.array(z.string().min(1)).max(50) })
const SellersBody = z.object({ sellerIds: z.array(z.string().min(1)).max(50) })

function mapCampaignError(err: unknown): never {
  if (err instanceof CampaignValidationError) {
    throw new HTTPException(400, { message: err.message })
  }
  if (err instanceof CampaignConflictError) {
    throw new HTTPException(409, { message: err.message })
  }
  throw err
}

/**
 * Phase 5A/5B — campaign management. Drafts are cheap and private; only
 * reviewed, scheduled, eligible campaigns reach buyers. Every transition
 * names its admin actor in the audit trail.
 */
export const adminCampaigns = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/placements", async (c) => {
    return c.json({ items: await c.get("campaigns").listPlacements() })
  })
  .get("/terms", async (c) => {
    return c.json({ items: await c.get("campaigns").listTerms() })
  })
  .post("/terms", async (c) => {
    const parsed = TermsBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const terms = await c.get("campaigns").createTerms(parsed.data)
      return c.json({ terms }, 201)
    } catch (err) {
      mapCampaignError(err)
    }
  })
  .get("/", async (c) => {
    const raw = c.req.query("status")
    const status = raw && (Status.options as string[]).includes(raw) ? (raw as z.infer<typeof Status>) : undefined
    return c.json({ items: await c.get("campaigns").listCampaigns(status) })
  })
  .post("/", async (c) => {
    const parsed = CreateBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const campaign = await c.get("campaigns").createCampaign({
        ...parsed.data,
        createdBy: c.get("auth").userId,
      })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "campaign.create",
        targetType: "campaign",
        targetId: campaign.id,
        detail: { name: campaign.name, placementCode: campaign.placementCode },
      })
      return c.json({ campaign }, 201)
    } catch (err) {
      mapCampaignError(err)
    }
  })
  .get("/:id", async (c) => {
    const detail = await c.get("campaigns").getCampaign(c.req.param("id"))
    if (!detail) throw new HTTPException(404, { message: "campaign not found" })
    return c.json(detail)
  })
  .patch("/:id", async (c) => {
    const parsed = PatchBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const campaign = await c.get("campaigns").updateCampaign(c.req.param("id"), parsed.data)
      if (!campaign) throw new HTTPException(404, { message: "campaign not found" })
      return c.json({ campaign })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCampaignError(err)
    }
  })
  .post("/:id/transitions", async (c) => {
    const parsed = z.object({ action: Transition }).safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const campaign = await c
        .get("campaigns")
        .transitionCampaign(c.req.param("id"), parsed.data.action as CampaignTransition, c.get("auth").userId)
      if (!campaign) throw new HTTPException(404, { message: "campaign not found" })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: `campaign.${parsed.data.action}`,
        targetType: "campaign",
        targetId: campaign.id,
        detail: { status: campaign.status },
      })
      return c.json({ campaign })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCampaignError(err)
    }
  })
  .delete("/:id", async (c) => {
    try {
      const deleted = await c.get("campaigns").deleteCampaign(c.req.param("id"))
      if (!deleted) throw new HTTPException(404, { message: "campaign not found" })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "campaign.delete",
        targetType: "campaign",
        targetId: c.req.param("id"),
        detail: {},
      })
      return c.json({ deleted: true })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCampaignError(err)
    }
  })
  .post("/:id/creatives", async (c) => {
    const parsed = CreativeBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const creative = await c.get("campaigns").addCreative(c.req.param("id"), parsed.data)
      return c.json({ creative }, 201)
    } catch (err) {
      mapCampaignError(err)
    }
  })
  .delete("/:id/creatives/:creativeId", async (c) => {
    const removed = await c.get("campaigns").removeCreative(c.req.param("id"), c.req.param("creativeId"))
    if (!removed) throw new HTTPException(404, { message: "creative not found" })
    return c.json({ deleted: true })
  })
  .post("/:id/products", async (c) => {
    const parsed = ProductsBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const created = await c.get("campaigns").ensureProductSet(c.req.param("id"))
      const set = await c.get("campaigns").setProductSetItems(
        c.req.param("id"),
        created.id,
        parsed.data.productIds,
      )
      if (!set) throw new HTTPException(404, { message: "campaign not found" })
      return c.json({ set })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCampaignError(err)
    }
  })
  .post("/:id/sellers", async (c) => {
    const parsed = SellersBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const created = await c.get("campaigns").ensureSellerSet(c.req.param("id"))
      const set = await c.get("campaigns").setSellerSetItems(
        c.req.param("id"),
        created.id,
        parsed.data.sellerIds,
      )
      if (!set) throw new HTTPException(404, { message: "campaign not found" })
      return c.json({ set })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCampaignError(err)
    }
  })
  .get("/:id/report", async (c) => {
    const report = await c.get("campaigns").reportCampaign(c.req.param("id"))
    if (!report) throw new HTTPException(404, { message: "campaign not found" })
    return c.json({ campaignId: c.req.param("id"), ...report })
  })
