/**
 * Soft gates on update-offers validate hook (same readiness as create).
 */
import { MedusaError } from "@medusajs/framework/utils"
import { updateOffersWorkflow } from "@mercurjs/core/workflows"
import {
  assertCanSell,
  evaluateSellerReadiness,
} from "../../lib/seller-readiness"

type OfferInput = {
  input?: {
    offers?: Array<{ seller_id?: string; id?: string }>
    seller_id?: string
  }
}

updateOffersWorkflow.hooks.validate(
  async ({ input }: OfferInput, { container }) => {
    const offers = input?.offers ?? []
    let sellerId =
      input?.seller_id ||
      offers.map((o) => o.seller_id).find(Boolean) ||
      ""

    const query = container.resolve("query") as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }

    // If seller_id missing, try resolve from first offer id
    if (!sellerId && offers[0]?.id) {
      try {
        const { data } = await query.graph({
          entity: "offer",
          fields: ["id", "seller_id"],
          filters: { id: offers[0].id },
        })
        const row = Array.isArray(data) ? data[0] : data
        if (row && typeof row === "object" && "seller_id" in row) {
          sellerId = String((row as { seller_id?: string }).seller_id || "")
        }
      } catch {
        /* continue */
      }
    }

    if (!sellerId) {
      // Updates without seller context — skip rather than hard-fail stock admin paths
      return
    }

    const readiness = await evaluateSellerReadiness(query, sellerId)
    if (!readiness) return

    try {
      assertCanSell(readiness, "offer")
    } catch (e) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        e instanceof Error ? e.message : "Seller cannot update offers",
      )
    }
  },
)
