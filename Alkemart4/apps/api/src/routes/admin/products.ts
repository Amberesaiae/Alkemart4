import { InvalidModerationTransitionError } from "@alkemart/domain"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AdminProductModerationAction, CatalogRepository } from "../../catalog-repository"
import type { AppEnv } from "../../context"
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
