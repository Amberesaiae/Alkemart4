import { evaluateSellerReadiness } from "@alkemart/domain"
import { createPaystackTransferRecipient, mapMomoProviderToPaystackSlug } from "@alkemart/paystack"
import { resolveRegionId, toLocalMsisdn, type PaystackMomoProvider } from "@alkemart/shared/ghana"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"

/** Paystack transferrecipient bank codes for Ghana MoMo (GET /bank). */
function momoBankCode(provider: PaystackMomoProvider): string {
  return mapMomoProviderToPaystackSlug(provider).toUpperCase()
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
    // Region may arrive as an ID ("GH07") or a display name ("Greater Accra").
    // Canonicalize to the ID for storage.
    const regionName = parsed.data.region.trim()
    const regionId = resolveRegionId(regionName)
    if (!regionId) {
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
    // Paystack mobile_money only accepts 0-prefixed local MSISDN — never E.164.
    const localPhone = toLocalMsisdn(parsed.data.momo.phone)
    if (!localPhone) throw new HTTPException(400, { message: "invalid MoMo number" })
    let recipient: { recipientCode: string }
    try {
      recipient = await createRecipient(
        { secretKey },
        {
          name: parsed.data.momo.accountName,
          accountNumber: localPhone,
          bankCode: momoBankCode(parsed.data.momo.provider),
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
      packRegion: regionId,
      digitalAddress: parsed.data.digitalAddress ?? null,
      deliveryFeePesewas: BigInt(parsed.data.deliveryFeePesewas),
      momoProvider: parsed.data.momo.provider,
      momoPhone: localPhone,
      recipientCode: recipient.recipientCode,
    })
    return c.json(evaluateSellerReadiness(updated))
  })
