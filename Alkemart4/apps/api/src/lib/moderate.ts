import { InvalidModerationTransitionError } from "@alkemart/domain"
import { HTTPException } from "hono/http-exception"
import type { AdminProductModerationAction, CatalogRepository } from "../catalog-repository"

/** Apply a moderation transition; 404/400 with the domain's reason. */
export async function moderateProduct(repo: CatalogRepository, productId: string, action: AdminProductModerationAction) {
  try {
    const product = await repo.moderateProduct(productId, action)
    if (!product) throw new HTTPException(404, { message: "product not found" })
    return product
  } catch (err) {
    if (err instanceof InvalidModerationTransitionError) throw new HTTPException(400, { message: err.message })
    throw err
  }
}
