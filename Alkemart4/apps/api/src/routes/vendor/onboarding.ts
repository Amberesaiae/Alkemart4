import { evaluateSellerReadiness } from "@alkemart/domain"
import { createPaystackTransferRecipient } from "@alkemart/paystack"
import { getRegionById, type PaystackMomoProvider } from "@alkemart/shared/ghana"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"

const PAYSTACK_MOMO_BANK_CODES: Record<PaystackMomoProvider, string> = {
  mtn: "MTN",
  vodafone: "VODAFONE",
  airteltigo: "AIRTELTIGO",
}

const GhanaSetupBody = z.object({
  displayName: z.string().trim().min(1).max(80),
  region: z.string().trim().min(1),
  digitalAddress: z.string().trim().min(1).max(32).optional(),
  deliveryFeePesewas: z.string().regex(/^\d+$/),
  momo: z.object({
    provider: z.enum(["mtn", "vodafone", "airteltigo"]),
    phone: z.string().trim().min(9).max(20),
    accountName: z.string().trim().min(1).max(80),
  }),
})

export const vendorOnboarding = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/status", async (c) => {
    const sellerId = c.get("auth").sellerId
    if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
    const seller = await c.get("authRepo").findSellerById(sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    return c.json(evaluateSellerReadiness(seller))
  })
  .post("/ghana-setup", async (c) => {
    const parsed = GhanaSetupBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    if (!getRegionById(parsed.data.region)) {
      throw new HTTPException(400, { message: "invalid region" })
    }

    const secretKey = c.get("paystackSecretKey")
    if (!secretKey) {
      throw new HTTPException(503, { message: "PAYSTACK_SECRET_KEY is not configured" })
    }

    const sellerId = c.get("auth").sellerId
    if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
    if (!(await c.get("authRepo").findSellerById(sellerId))) {
      throw new HTTPException(404, { message: "seller not found" })
    }

    const createRecipient =
      c.get("createPaystackTransferRecipient") ?? createPaystackTransferRecipient
    let recipient: { recipientCode: string }
    try {
      recipient = await createRecipient(
        { secretKey },
        {
          name: parsed.data.momo.accountName,
          accountNumber: parsed.data.momo.phone,
          bankCode: PAYSTACK_MOMO_BANK_CODES[parsed.data.momo.provider],
          currency: "GHS",
        },
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : "Paystack transfer recipient failed"
      throw new HTTPException(502, { message })
    }
    if (!recipient?.recipientCode) {
      throw new HTTPException(502, { message: "Paystack did not return a recipient_code" })
    }

    const updated = await c.get("authRepo").updateSellerGhanaSetup(sellerId, {
      name: parsed.data.displayName,
      packRegion: parsed.data.region,
      digitalAddress: parsed.data.digitalAddress ?? null,
      deliveryFeePesewas: BigInt(parsed.data.deliveryFeePesewas),
      momoProvider: parsed.data.momo.provider,
      momoPhone: parsed.data.momo.phone,
      recipientCode: recipient.recipientCode,
    })
    return c.json(evaluateSellerReadiness(updated))
  })
