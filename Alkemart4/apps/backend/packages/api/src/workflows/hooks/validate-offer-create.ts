/**
 * Non-bypassable soft gates on create-offers validate hook.
 */
import { MedusaError } from "@medusajs/framework/utils"
import { createOffersWorkflow } from "@mercurjs/core/workflows"
import {
  assertCanSell,
  evaluateSellerReadiness,
} from "../../lib/seller-readiness"

type OfferInput = {
  input?: {
    offers?: Array<{ seller_id?: string }>
    seller_id?: string
  }
}

createOffersWorkflow.hooks.validate(
  async ({ input }: OfferInput, { container }) => {
    const offers = input?.offers ?? []
    const sellerId =
      input?.seller_id ||
      offers.map((o) => o.seller_id).find(Boolean) ||
      ""

    if (!sellerId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot create offers without seller_id",
      )
    }

    const query = container.resolve("query") as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }

    const readiness = await evaluateSellerReadiness(query, sellerId)
    if (!readiness) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Seller ${sellerId} not found`,
      )
    }

    try {
      assertCanSell(readiness, "offer")
    } catch (e) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        e instanceof Error ? e.message : "Seller cannot create offers",
      )
    }
  },
)
