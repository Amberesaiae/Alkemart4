import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AdminProductModerationAction, CatalogRepository } from "../../catalog-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { moderateProduct } from "../../lib/moderate"
import { requireAdmin } from "../../middleware/auth"

/** Optional reasons on any decision — what the seller will read. */
const DecisionBody = z.object({
  reasons: z
    .array(z.object({ code: z.string().trim().min(1).max(40), message: z.string().trim().min(1).max(300), field: z.string().max(40).optional() }))
    .max(10)
    .optional(),
  note: z.string().trim().max(1000).optional().nullable(),
})

const PRODUCT_STATUSES = new Set(["draft", "proposed", "published", "rejected"])

export const adminProducts = new Hono<AppEnv>()
  .use("*", requireAdmin)
  /** Listing review mode: manual (humans only) · assist (AI advises) · auto (AI may approve clear passes). */
  .get("/review-settings", async (c) => c.json({ mode: await c.get("reviews").getReviewMode() }))
  .put("/review-settings", async (c) => {
    const parsed = z.object({ mode: z.enum(["trust", "manual", "assist", "auto"]) }).safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "mode must be trust, manual, assist or auto" })
    await c.get("reviews").setReviewMode(parsed.data.mode, c.get("auth").userId)
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "settings.listing-review-mode",
      targetType: "setting",
      targetId: "listing_review_mode",
      detail: { mode: parsed.data.mode },
    })
    return c.json({ mode: parsed.data.mode })
  })
  .get("/:id/reviews", async (c) => {
    const history = await c.get("reviews").history(c.req.param("id"))
    return c.json({
      reviews: history.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    })
  })
  .get("/", async (c) => {
    const statusRaw = c.req.query("status")?.trim()
    const status =
      statusRaw && PRODUCT_STATUSES.has(statusRaw)
        ? (statusRaw as "draft" | "proposed" | "published" | "rejected")
        : undefined
    const [items, sellers] = await Promise.all([
      c.get("repo").listAdminProductsWithFlags(status),
      c.get("authRepo").listSellers(),
    ])
    const sellerById = new Map(sellers.map((s) => [s.id, s]))
    const latest = await c.get("reviews").latest(items.map((p) => p.id)).catch(() => new Map())
    return c.json({
      items: items.map((p) => {
        const seller = (p as { sellerId?: string | null }).sellerId
          ? sellerById.get((p as { sellerId?: string | null }).sellerId as string)
          : undefined
        return {
          ...p,
          sellerName: seller?.name ?? null,
          sellerHandle: seller?.handle ?? null,
          review: (() => {
            const r = latest.get(p.id)
            return r ? { ...r, createdAt: r.createdAt.toISOString() } : null
          })(),
        }
      }),
    })
  })
  .get("/:id", async (c) => {
    const detail = await c.get("repo").getAdminProductDetail(c.req.param("id"))
    if (!detail) throw new HTTPException(404, { message: "product not found" })
    return c.json(detail)
  })
  .post("/:id/approve", async (c) => {
    const body = DecisionBody.safeParse(await readJsonBody(c).catch(() => ({})))
    const reasons = body.success ? (body.data.reasons ?? []) : []
    const note = body.success ? (body.data.note ?? null) : null
    const product = await moderateProduct(c.get("repo"), c.req.param("id"), "approve")
    await c
      .get("reviews")
      .record({ productId: c.req.param("id"), decision: "approve", reviewer: "admin", reviewerId: c.get("auth").userId, reasons, note })
      .catch(() => undefined)
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "product.approve",
      targetType: "product",
      targetId: c.req.param("id"),
      detail: { status: product.status },
    })
    return c.json({ product })
  })
  .post("/:id/reject", async (c) => {
    const body = DecisionBody.safeParse(await readJsonBody(c).catch(() => ({})))
    const reasons = body.success ? (body.data.reasons ?? []) : []
    const note = body.success ? (body.data.note ?? null) : null
    const product = await moderateProduct(c.get("repo"), c.req.param("id"), "reject")
    await c
      .get("reviews")
      .record({ productId: c.req.param("id"), decision: "reject", reviewer: "admin", reviewerId: c.get("auth").userId, reasons, note })
      .catch(() => undefined)
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "product.reject",
      targetType: "product",
      targetId: c.req.param("id"),
      detail: { status: product.status },
    })
    return c.json({ product })
  })
  .post("/:id/request-changes", async (c) => {
    const body = DecisionBody.safeParse(await readJsonBody(c).catch(() => ({})))
    const reasons = body.success ? (body.data.reasons ?? []) : []
    const note = body.success ? (body.data.note ?? null) : null
    const product = await moderateProduct(c.get("repo"), c.req.param("id"), "request_changes")
    await c
      .get("reviews")
      .record({ productId: c.req.param("id"), decision: "request_changes", reviewer: "admin", reviewerId: c.get("auth").userId, reasons, note })
      .catch(() => undefined)
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "product.request-changes",
      targetType: "product",
      targetId: c.req.param("id"),
      detail: { status: product.status },
    })
    return c.json({ product })
  })
  /**
   * Phase 1B — reviewed identity promotion (ADR-002).
   * The reviewer is the admin performing the call; unreviewed promotion
   * is rejected by the domain, never silently applied.
   */
  .post("/:id/identity/promote", async (c) => {
    const parsed = z
      .object({ confidence: z.enum(["matched", "identified"]) })
      .safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const identity = await c
        .get("repo")
        .promoteProductIdentity(c.req.param("id"), parsed.data.confidence, c.get("auth").userId)
      if (!identity) throw new HTTPException(404, { message: "product not found" })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "product.identity-promote",
        targetType: "product",
        targetId: c.req.param("id"),
        detail: { confidence: parsed.data.confidence },
      })
      return c.json({ identity })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      const message = err instanceof Error ? err.message : String(err)
      throw new HTTPException(400, { message })
    }
  })
