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
    const items = await c.get("repo").listAdminProducts(status)
    return c.json({ items })
  })
  .post("/:id/approve", async (c) => {
    const product = await moderateProduct(c.get("repo"), c.req.param("id"), "approve")
    return c.json({ product })
  })
  .post("/:id/reject", async (c) => {
    const product = await moderateProduct(c.get("repo"), c.req.param("id"), "reject")
    return c.json({ product })
  })
  .post("/:id/request-changes", async (c) => {
    const product = await moderateProduct(c.get("repo"), c.req.param("id"), "request_changes")
    return c.json({ product })
  })
