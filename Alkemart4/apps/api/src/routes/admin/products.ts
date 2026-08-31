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

export const adminProducts = new Hono<AppEnv>()
  .use("*", requireAdmin)
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
