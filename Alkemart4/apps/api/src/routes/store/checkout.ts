import {
  chargePaystackMobileMoney,
  initializePaystackTransaction,
} from "@alkemart/paystack"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { confirmCheckoutFromPaystack } from "../../lib/checkout-confirm"

const ShippingAddress = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(9).max(20),
  address_1: z.string().trim().min(1).max(200),
  address_2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(80),
  province: z.string().trim().max(80).optional(),
  country_code: z.string().trim().min(2).max(2),
  postal_code: z.string().trim().max(40).optional(),
})

const CheckoutBase = {
  cartId: z.string().min(1),
  buyerEmail: z.string().email(),
  shippingAddress: ShippingAddress,
}

const CheckoutBody = z.discriminatedUnion("method", [
  z.object({
    ...CheckoutBase,
    method: z.literal("cod"),
  }),
  z.object({
    ...CheckoutBase,
    method: z.literal("momo"),
    momo: z.object({
      provider: z.enum(["mtn", "vodafone", "airteltigo"]),
      phone: z.string().min(9).max(20),
    }),
  }),
  z.object({
    ...CheckoutBase,
    method: z.literal("card"),
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

export const storeCheckout = new Hono<AppEnv>()
  .get("/status", async (c) => {
    const cartId = c.req.query("cartId")?.trim() || c.req.query("cart_id")?.trim()
    if (!cartId) throw new HTTPException(400, { message: "cartId required" })

    const checkout = c.get("checkoutRepo")
    const intent = await checkout.getLatestPaymentIntentByCartId(cartId)
    if (!intent) throw new HTTPException(404, { message: "payment not found" })

    if (intent.status === "completed") {
      const group = await checkout.getOrderGroupByPaymentIntent(intent.id)
      return c.json({
        status: "completed",
        cart_id: cartId,
        cartId,
        order_id: group?.id ?? null,
        orderGroupId: group?.id ?? null,
        paymentIntentId: intent.id,
        payment_intent_id: intent.id,
      })
    }

    if (intent.status === "failed" || intent.status === "expired") {
      return c.json({
        status: "failed",
        cart_id: cartId,
        cartId,
        message: `Payment ${intent.status}`,
        paymentIntentId: intent.id,
        payment_intent_id: intent.id,
      })
    }

    // MoMo/card: poll may arrive before webhook — verify with Paystack when pending.
    if (
      (intent.status === "pending" || intent.status === "succeeded") &&
      intent.paystackReference &&
      (intent.method === "momo" || intent.method === "card")
    ) {
      const secretKey = c.get("paystackSecretKey")
      if (secretKey) {
        try {
          const confirmed = await confirmCheckoutFromPaystack(checkout, {
            paymentIntentId: intent.id,
            paystackSecretKey: secretKey,
            verify: c.get("verifyPaystackTransaction"),
          })
          return c.json({
            status: "completed",
            cart_id: cartId,
            cartId,
            order_id: confirmed.orderGroup.id,
            orderGroupId: confirmed.orderGroup.id,
            paymentIntentId: intent.id,
            payment_intent_id: intent.id,
          })
        } catch {
          // Still pending or verify failed — keep polling; webhook may finish later.
        }
      }
    }

    return c.json({
      status: "payment_pending",
      cart_id: cartId,
      cartId,
      paymentIntentId: intent.id,
      payment_intent_id: intent.id,
      client_reference: intent.paystackReference,
      provider_reference: intent.paystackReference,
      amount_pesewas: Number(intent.amountPesewas),
      provider_status: intent.status,
    })
  })
  .post("/", async (c) => {
    const parsed = CheckoutBody.safeParse(await readBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })

    const checkout = c.get("checkoutRepo")
    const cart = await checkout.getCart(parsed.data.cartId)
    if (!cart) throw new HTTPException(404, { message: "cart not found" })

    const items = await checkout.listCartItems(cart.id)
    if (items.length === 0) throw new HTTPException(400, { message: "cart empty" })

    // Server-enforced pause guard: a paused seller's offers can sit in carts,
    // but no order may be created for them. Never button-only.
    const sellerIds = [...new Set(items.map((i) => i.sellerId))]
    for (const sellerId of sellerIds) {
      const seller = await c.get("authRepo").findSellerById(sellerId).catch(() => null)
      if (seller?.availability === "paused") {
        throw new HTTPException(409, {
          message: `Seller ${seller.handle} is paused and not taking orders${seller.pauseNote ? `: ${seller.pauseNote}` : ""}`,
        })
      }
    }

    const quote = await checkout.quote(cart.id)
    const intentId = crypto.randomUUID()
    const reference = `alk_${intentId.replace(/-/g, "").slice(0, 24)}`
    const shippingAddress = parsed.data.shippingAddress

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
        shippingAddress,
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

    // The intent row is created (with its Paystack reference) BEFORE contacting
    // Paystack. Any charge that reaches Paystack is therefore traceable in
    // Postgres: if the row were created after the charge, a failed insert or a
    // fast webhook would leave real money with no ledger record.
    const momo = parsed.data.method === "momo" ? parsed.data.momo : null
    const method = momo ? "momo" : "card"
    await checkout.createPaymentIntent({
      id: intentId,
      cartId: cart.id,
      method,
      status: "initiated",
      amountPesewas: quote.totalPesewas,
      currency: "ghs",
      paystackReference: reference,
      buyerEmail: parsed.data.buyerEmail,
      momoProvider: momo?.provider ?? null,
      momoPhone: momo?.phone ?? null,
      shippingAddress,
    })

    /** Mark the intent failed, then surface the error to the buyer. */
    async function failIntent(
      message: string,
      httpStatus: 502 | 409,
    ): Promise<HTTPException> {
      try {
        await checkout.updatePaymentIntentStatus(intentId, "failed")
      } catch {
        /* terminal-state races leave the intent pending for the expiry job */
      }
      return new HTTPException(httpStatus, { message })
    }

    const lineHolds = items.map((i) => ({ offerId: i.offerId, qty: i.qty }))

    /** Hold stock before any Paystack call so we never debit/redirect without inventory. */
    async function holdStock(): Promise<void> {
      try {
        await checkout.reserveStock(intentId, lineHolds)
      } catch (err) {
        await checkout.releaseReservations(intentId)
        throw await failIntent(
          err instanceof Error && err.message.includes("insufficient stock")
            ? "Some items in your cart just sold out. Remove or adjust them and try again."
            : "Could not hold stock for this order",
          409,
        )
      }
    }

    if (parsed.data.method === "momo") {
      await holdStock()
      await checkout.updatePaymentIntentStatus(intentId, "pending")

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
        await checkout.releaseReservations(intentId)
        throw await failIntent(
          err instanceof Error ? err.message : "Paystack charge failed",
          502,
        )
      }

      return c.json({
        paymentIntentId: intentId,
        status: "pending",
        paystackReference: charged.reference || reference,
        paystackStatus: charged.status,
      })
    }

    // card — reserve before initialize so orphaned Paystack sessions can't outrun stock
    await holdStock()
    await checkout.updatePaymentIntentStatus(intentId, "pending")

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
      await checkout.releaseReservations(intentId)
      throw await failIntent(
        err instanceof Error ? err.message : "Paystack initialize failed",
        502,
      )
    }

    return c.json({
      paymentIntentId: intentId,
      status: "pending",
      authorizationUrl: initResult.authorizationUrl,
      paystackReference: initResult.reference || reference,
    })
  })
