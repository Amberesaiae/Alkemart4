/**
 * POST /store/ghana-checkout — SPA Ghana checkout contract.
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
  // Optional customer bind — store may send JWT; guest checkout remains allowed
  // Medusa attaches auth_context after authenticate; not on base MedusaRequest types
  const auth = (req as MedusaRequest & {
    auth_context?: { actor_id?: string }
  }).auth_context
  const customerId =
    typeof auth?.actor_id === "string" ? auth.actor_id : null

  try {
    const result = await runGhanaCheckout(req.scope, {
      cartId: body.cart_id,
      paymentMethod: body.payment_method,
      email: body.email,
      phone: body.phone,
      momoProvider: body.momo_provider,
      customerId,
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
    const message =
      err instanceof Error ? err.message : "Checkout failed unexpectedly"
    res.status(500).json({ error: message })
  }
}
