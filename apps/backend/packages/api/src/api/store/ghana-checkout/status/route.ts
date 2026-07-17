/**
 * GET /store/ghana-checkout/status?cart_id=…
 * SPA poll while MoMo pending (USSD / pay offline).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  CheckoutHttpError,
  getMomoCheckoutStatus,
} from "../../../../lib/ghana-checkout"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cartId = String(
    (req.query?.cart_id as string | undefined) ||
      (req.query?.cartId as string | undefined) ||
      ""
  ).trim()

  if (!cartId) {
    res.status(400).json({ error: "cart_id query parameter is required" })
    return
  }

  try {
    const result = await getMomoCheckoutStatus(req.scope, cartId)
    if (result.status === "completed") {
      res.status(200).json(result)
      return
    }
    if (result.status === "payment_pending") {
      res.status(202).json(result)
      return
    }
    if (result.status === "failed") {
      res.status(402).json(result)
      return
    }
    res.status(200).json(result)
  } catch (err) {
    if (err instanceof CheckoutHttpError) {
      res.status(err.status).json({ error: err.message })
      return
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : "Status check failed",
    })
  }
}
