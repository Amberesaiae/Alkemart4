/**
 * Ghana checkout store API (Phase 3.3 commercial spine).
 *
 * ## API contract (SPA)
 *
 * `POST /store/ghana-checkout`
 * Headers: `x-publishable-api-key` (required for /store routes)
 * Body:
 * ```json
 * {
 *   "cart_id": "cart_...",
 *   "payment_method": "cod" | "momo",
 *   "email": "...",                 // required for momo
 *   "phone": "...",                 // required for momo
 *   "momo_provider": "mtn" | "vodafone" | "airteltigo"  // required for momo
 * }
 * ```
 *
 * Responses:
 * - COD / MoMo sync success → **200**
 *   `{ "status": "completed", "order_id": "...", "cart_id": "..." }`
 * - MoMo async pending → **202**
 *   `{ "status": "payment_pending", "cart_id", "payment_intent_id",
 *      "client_reference", "provider_reference", "expires_at", "amount_pesewas" }`
 * - Errors → **400** / **402** / **409** / **404**
 *   `{ "error": "human readable message" }`
 *
 * Notes:
 * - COD uses Medusa system payment provider + completeCartWorkflow.
 * - MoMo creates payments-ghana intent BEFORE Paystack HTTP (ADR-014).
 * - Cart is never completed until MoMo payment success (sync or webhook).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import {
  CheckoutHttpError,
  runGhanaCheckout,
} from "../../../lib/ghana-checkout"

const bodySchema = z
  .object({
    cart_id: z.string().min(1),
    payment_method: z.enum(["cod", "momo"]),
    email: z.string().email().optional(),
    phone: z.string().min(6).optional(),
    momo_provider: z.enum(["mtn", "vodafone", "airteltigo"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.payment_method === "momo") {
      if (!data.email) {
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "email is required for momo",
        })
      }
      if (!data.phone) {
        ctx.addIssue({
          code: "custom",
          path: ["phone"],
          message: "phone is required for momo",
        })
      }
      if (!data.momo_provider) {
        ctx.addIssue({
          code: "custom",
          path: ["momo_provider"],
          message: "momo_provider is required for momo",
        })
      }
    }
  })

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ")
    res.status(400).json({ error: message || "Invalid request body" })
    return
  }

  const body = parsed.data

  try {
    const result = await runGhanaCheckout(req.scope, {
      cartId: body.cart_id,
      paymentMethod: body.payment_method,
      email: body.email,
      phone: body.phone,
      momoProvider: body.momo_provider,
    })

    if (result.status === "payment_pending") {
      res.status(202).json(result)
      return
    }

    res.status(200).json(result)
  } catch (err) {
    if (err instanceof CheckoutHttpError) {
      res.status(err.status).json({ error: err.message })
      return
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : "Checkout failed",
    })
  }
}
