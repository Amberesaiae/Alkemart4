/**
 * POST /vendor/alkemart/onboarding/ghana-setup
 *
 * One-tap Ghana commerce setup for approved sellers.
 * Body (plain Ghana language — no stock/shipping jargon required):
 * {
 *   "pack_from_name": "Ama's shop — Madina",
 *   "address_1": "Near Goil, junction",
 *   "city": "Accra",
 *   "region": "Greater Accra",
 *   "postal_code": "GA-184-1234",  // optional GhanaPostGPS
 *   "phone": "0241234567",
 *   "delivery_fee_ghs": 20
 * }
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runGhanaSellerSetup } from "../../../../../lib/ghana-seller-setup"
import { invalidateSellerReadiness } from "../../../../../lib/seller-readiness-cache"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string }
  session?: { seller_id?: string }
  body?: Record<string, unknown>
}

export async function POST(req: SellerReq, res: MedusaResponse) {
  const sellerId =
    req.seller_context?.seller_id ||
    req.session?.seller_id ||
    req.get("x-seller-id") ||
    ""

  if (!sellerId) {
    res.status(400).json({
      error: "Select your shop first, then try again.",
    })
    return
  }

  const body = (req.body || {}) as Record<string, unknown>
  const address_1 = String(body.address_1 || body.area || "").trim()
  const city = String(body.city || "").trim()

  if (!address_1 || !city) {
    res.status(400).json({
      error:
        "We need where you pack from: area/street and city (e.g. Madina, Accra).",
      fields: {
        address_1: "Area, street, or landmark",
        city: "City or town",
        region: "Region (optional, e.g. Greater Accra)",
        delivery_fee_ghs: "Delivery fee in GH₵ (optional, default 20)",
      },
    })
    return
  }

  try {
    const result = await runGhanaSellerSetup(req.scope, {
      seller_id: sellerId,
      pack_from_name:
        typeof body.pack_from_name === "string"
          ? body.pack_from_name
          : typeof body.location_name === "string"
            ? body.location_name
            : undefined,
      address_1,
      city,
      region:
        typeof body.region === "string"
          ? body.region
          : typeof body.province === "string"
            ? body.province
            : undefined,
      postal_code:
        typeof body.postal_code === "string"
          ? body.postal_code
          : typeof body.ghana_post_gps === "string"
            ? body.ghana_post_gps
            : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      delivery_fee_ghs:
        typeof body.delivery_fee_ghs === "number"
          ? body.delivery_fee_ghs
          : typeof body.delivery_fee === "number"
            ? body.delivery_fee
            : undefined,
      delivery_label:
        typeof body.delivery_label === "string"
          ? body.delivery_label
          : undefined,
    })

    void invalidateSellerReadiness(sellerId)
    res.status(200).json({
      message:
        result.readiness?.phase === "active"
          ? "You're set for Ghana. Add products with GH₵ prices — buyers pay COD or MoMo."
          : "Ghana delivery setup saved. Check the list below if anything is still missing.",
      ...result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Setup failed"
    res.status(400).json({ error: msg })
  }
}
