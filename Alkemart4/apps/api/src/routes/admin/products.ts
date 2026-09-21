import { InvalidModerationTransitionError } from "@alkemart/domain"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AdminProductModerationAction, CatalogRepository } from "../../catalog-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

async function moderateProduct(
  repo: CatalogRepository,
  productId: string,
  action: AdminProductModerationAction,
) {
  try {
    const product = await repo.moderateProduct(productId, action)
    if (!product) throw new HTTPException(404, { message: "product not found" })
    return product
  } catch (err) {
    if (err instanceof InvalidModerationTransitionError) {
      throw new HTTPException(400, { message: err.message })
    }
    throw err
  }
}

const PRODUCT_STATUSES = new Set(["draft", "proposed", "published", "rejected"])

export const adminProducts = new Hono<AppEnv>()
  .use("*", requireAdmin)
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
    return c.json({
      items: items.map((p) => {
        const seller = (p as { sellerId?: string | null }).sellerId
          ? sellerById.get((p as { sellerId?: string | null }).sellerId as string)
          : undefined
        return {
          ...p,
          sellerName: seller?.name ?? null,
          sellerHandle: seller?.handle ?? null,
        }
      }),
    })
  })
  .get("/:id", async (c) => {
    const detail = await c.get("repo").getAdminProductDetail(c.req.param("id"))
    if (!detail) throw new HTTPException(404, { message: "product not found" })
    return c.json(detail)
  })
  .post("/:id/approve", async (c) => {    const product = await moderateProduct(c.get("repo"), c.req.param("id"), "approve")
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
    const product = await moderateProduct(c.get("repo"), c.req.param("id"), "reject")
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
    const product = await moderateProduct(c.get("repo"), c.req.param("id"), "request_changes")
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
