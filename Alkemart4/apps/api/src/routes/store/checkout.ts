import {
  chargePaystackMobileMoney,
  initializePaystackTransaction,
} from "@alkemart/paystack"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"

const CheckoutBody = z.discriminatedUnion("method", [
  z.object({
    cartId: z.string().min(1),
    method: z.literal("cod"),
    buyerEmail: z.string().email(),
  }),
  z.object({
    cartId: z.string().min(1),
    method: z.literal("momo"),
    buyerEmail: z.string().email(),
    momo: z.object({
      provider: z.enum(["mtn", "vodafone", "airteltigo"]),
      phone: z.string().min(9).max(20),
    }),
  }),
  z.object({
    cartId: z.string().min(1),
    method: z.literal("card"),
    buyerEmail: z.string().email(),
    callbackUrl: z.string().url(),
  }),
])

async function readBody(c: { req: { json: () => Promise<unknown> } }) {
  try {
    return await c.req.json()
  } catch {
    throw new HTTPException(400, { message: "invalid json" })
  }
}

export const storeCheckout = new Hono<AppEnv>().post("/", async (c) => {
  const parsed = CheckoutBody.safeParse(await readBody(c))
  if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })

  const checkout = c.get("checkoutRepo")
  const cart = await checkout.getCart(parsed.data.cartId)
  if (!cart) throw new HTTPException(404, { message: "cart not found" })

  const items = await checkout.listCartItems(cart.id)
  if (items.length === 0) throw new HTTPException(400, { message: "cart empty" })

  const quote = await checkout.quote(cart.id)
  const intentId = crypto.randomUUID()
  const reference = `alk_${intentId.replace(/-/g, "").slice(0, 24)}`

  if (parsed.data.method === "cod") {
    await checkout.createPaymentIntent({
      id: intentId,
      cartId: cart.id,
      method: "cod",
      status: "initiated",
      amountPesewas: quote.totalPesewas,
      currency: "ghs",
      paystackReference: null,
      buyerEmail: parsed.data.buyerEmail,
      momoProvider: null,
      momoPhone: null,
    })
    const { orderGroup, orders } = await checkout.confirmPaidOrder(intentId)
    return c.json({
      paymentIntentId: intentId,
      status: "completed",
      orderGroupId: orderGroup.id,
      orders: orders.map((o) => ({ id: o.id, sellerId: o.sellerId })),
    })
  }

  const secretKey = c.get("paystackSecretKey")
  if (!secretKey) {
    throw new HTTPException(503, { message: "PAYSTACK_SECRET_KEY is not configured" })
  }

  if (parsed.data.method === "momo") {
    const charge =
      c.get("chargePaystackMobileMoney") ?? chargePaystackMobileMoney
    let charged: { status: string; reference: string }
    try {
      charged = await charge(
        { secretKey },
        {
          email: parsed.data.buyerEmail,
          amountPesewas: quote.totalPesewas,
          phone: parsed.data.momo.phone,
          provider: parsed.data.momo.provider,
          reference,
        },
      )
    } catch (err) {
      throw new HTTPException(502, {
        message: err instanceof Error ? err.message : "Paystack charge failed",
      })
    }

    await checkout.createPaymentIntent({
      id: intentId,
      cartId: cart.id,
      method: "momo",
      status: "initiated",
      amountPesewas: quote.totalPesewas,
      currency: "ghs",
      paystackReference: charged.reference,
      buyerEmail: parsed.data.buyerEmail,
      momoProvider: parsed.data.momo.provider,
      momoPhone: parsed.data.momo.phone,
    })
    await checkout.updatePaymentIntentStatus(intentId, "pending")
    await checkout.reserveStock(
      intentId,
      items.map((i) => ({ offerId: i.offerId, qty: i.qty })),
    )

    return c.json({
      paymentIntentId: intentId,
      status: "pending",
      paystackReference: charged.reference,
      paystackStatus: charged.status,
    })
  }

  // card
  const initialize =
    c.get("initializePaystackTransaction") ?? initializePaystackTransaction
  let initResult: { authorizationUrl: string; reference: string; accessCode: string }
  try {
    initResult = await initialize(
      { secretKey },
      {
        email: parsed.data.buyerEmail,
        amountPesewas: quote.totalPesewas,
        reference,
        callbackUrl: parsed.data.callbackUrl,
      },
    )
  } catch (err) {
    throw new HTTPException(502, {
      message: err instanceof Error ? err.message : "Paystack initialize failed",
    })
  }

  await checkout.createPaymentIntent({
    id: intentId,
    cartId: cart.id,
    method: "card",
    status: "initiated",
    amountPesewas: quote.totalPesewas,
    currency: "ghs",
    paystackReference: initResult.reference,
    buyerEmail: parsed.data.buyerEmail,
    momoProvider: null,
    momoPhone: null,
  })
  await checkout.updatePaymentIntentStatus(intentId, "pending")

  return c.json({
    paymentIntentId: intentId,
    status: "pending",
    authorizationUrl: initResult.authorizationUrl,
    paystackReference: initResult.reference,
  })
})
