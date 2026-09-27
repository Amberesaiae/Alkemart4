import { createHmac } from "node:crypto"
import { hashPassword } from "@alkemart/domain"
import { PaystackError } from "@alkemart/paystack"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import type { CreatePaystackTransfer, VerifyPaystackTransfer } from "../../context"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { signSessionJwt } from "../../lib/jwt"
import { reconcileStaleIntent } from "../../lib/intent-reconcile"
import { resetRateLimits } from "../../middleware/security"
resetRateLimits()

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"
const SK = "sk_test_trust"

/** A seller with two delivered, paid-online orders and an admin token. */
async function world(opts: { transfer?: CreatePaystackTransfer; verifyTransfer?: VerifyPaystackTransfer } = {}) {
  const snapshot = demoCatalog()
  const catalog = new InMemoryCatalogRepository(snapshot)
  const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
  const authRepo = new InMemoryAuthRepository()
  await authRepo.registerVendor({
    user: { id: "u-seller-a", email: "seller-a@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
    seller: { id: "seller-a", handle: "seller-a-trust", name: "Accra Mart" },
  })
  await authRepo.updateSellerStatus("seller-a", "open")
  await authRepo.updateSellerGhanaSetup("seller-a", {
    name: "Accra Mart",
    packRegion: "greater_accra",
    digitalAddress: null,
    deliveryFeePesewas: 500n,
    momoProvider: "mtn",
    momoPhone: "0244123456",
    recipientCode: "RCP_test",
  })
  await authRepo.updateSellerCommission("seller-a", 700)
  await authRepo.createUser({ id: "admin-1", email: "admin@alkemart.test", passwordHash: await hashPassword("AdminPass1"), role: "admin" })
  const adminToken = await signSessionJwt({ userId: "admin-1", role: "admin" }, JWT)

  const orderIds: string[] = []
  for (let i = 0; i < 2; i++) {
    const cart = await checkoutRepo.createCart()
    await checkoutRepo.addCartItem(cart.id, "offer-a", 1)
    const quote = await checkoutRepo.quote(cart.id)
    const intentId = crypto.randomUUID()
    await checkoutRepo.createPaymentIntent({
      id: intentId, cartId: cart.id, method: "momo", status: "initiated", amountPesewas: quote.totalPesewas, currency: "GHS",
      paystackReference: null, buyerEmail: "buyer@t.test", momoProvider: null, momoPhone: null, shippingAddress: null,
    })
    const { orders } = await checkoutRepo.confirmPaidOrder(intentId)
    await checkoutRepo.updateOrderStatus(orders[0]!.id, "seller-a", "shipped")
    await checkoutRepo.updateOrderStatus(orders[0]!.id, "seller-a", "delivered")
    orderIds.push(orders[0]!.id)
  }
  const references: string[] = []
  const app = createApp({
    repo: catalog,
    checkoutRepo,
    authRepo,
    jwtSecret: JWT,
    paystackSecretKey: SK,
    createPaystackTransfer: async (cfg, input) => {
      references.push(input.reference)
      return opts.transfer ? opts.transfer(cfg, input) : { transferCode: "TRF_x", reference: input.reference, status: "pending" }
    },
    verifyPaystackTransfer: opts.verifyTransfer,
  })
  const call = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  const hook = (payload: unknown) => {
    const raw = JSON.stringify(payload)
    return app.request("/hooks/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": createHmac("sha512", SK).update(raw).digest("hex"), "Content-Type": "application/json" },
      body: raw,
    })
  }
  return { app, checkoutRepo, orderIds, references, call, hook }
}

type PayoutBody = { payout: { id: string; status: string; netPesewas: string; paystackReference: string; failureReason: string | null }; outcome?: string }

describe("payouts you can trust", () => {
  it("never pays a held order, and an account hold blocks the payout", async () => {
    const w = await world()
    await w.checkoutRepo.createPayoutHold({ sellerId: "seller-a", orderId: w.orderIds[0], reason: "buyer dispute", createdBy: "admin-1" })
    const res = await w.call("POST", "/admin/payouts", { sellerId: "seller-a" })
    const body = (await res.json()) as PayoutBody
    // Only the un-held order: 1500 − 7% = 1395.
    expect(body.payout.netPesewas).toBe("1395")

    const w2 = await world()
    await w2.checkoutRepo.createPayoutHold({ sellerId: "seller-a", reason: "account review", createdBy: "admin-1" })
    const blocked = await w2.call("POST", "/admin/payouts", { sellerId: "seller-a" })
    expect(blocked.status).toBe(409)
  })

  it("is 'sent', not 'paid', until Paystack confirms — then the webhook settles it", async () => {
    const w = await world()
    const sent = (await (await w.call("POST", "/admin/payouts", { sellerId: "seller-a" })).json()) as PayoutBody
    expect(sent.outcome).toBe("sent")
    expect(sent.payout.status).toBe("processing")
    // A second press doesn't move money again.
    const again = (await (await w.call("POST", "/admin/payouts", { sellerId: "seller-a" })).json()) as PayoutBody & { replayed?: boolean }
    expect(again.replayed).toBe(true)
    expect(w.references).toHaveLength(1)

    const ok = await w.hook({ event: "transfer.success", data: { id: 1, reference: sent.payout.paystackReference, amount: Number(sent.payout.netPesewas), transfer_code: "TRF_x" } })
    expect(ok.status).toBe(200)
    const detail = (await (await w.call("GET", `/admin/payouts/${sent.payout.id}`)).json()) as PayoutBody & { events: { status: string }[] }
    expect(detail.payout.status).toBe("paid")
    expect(detail.events.map((e) => e.status)).toEqual(["created", "sent", "paid"])
  })

  it("a failed transfer frees the orders for the next payout, with the reason", async () => {
    const w = await world()
    const sent = (await (await w.call("POST", "/admin/payouts", { sellerId: "seller-a" })).json()) as PayoutBody
    await w.hook({ event: "transfer.failed", data: { id: 2, reference: sent.payout.paystackReference, amount: Number(sent.payout.netPesewas), gateway_response: "Recipient account is invalid" } })
    const detail = (await (await w.call("GET", `/admin/payouts/${sent.payout.id}`)).json()) as PayoutBody
    expect(detail.payout.status).toBe("failed")
    expect(detail.payout.failureReason).toBe("Recipient account is invalid")
    expect(await w.checkoutRepo.listDeliveredUnpaidOrders("seller-a")).toHaveLength(2)
  })

  it("refuses to settle when Paystack's amount doesn't match (alert instead)", async () => {
    const w = await world()
    const sent = (await (await w.call("POST", "/admin/payouts", { sellerId: "seller-a" })).json()) as PayoutBody
    await w.hook({ event: "transfer.success", data: { id: 3, reference: sent.payout.paystackReference, amount: 1 } })
    expect((await w.checkoutRepo.getPayout(sent.payout.id))?.status).toBe("processing")
    const log = (await (await w.call("GET", "/admin/payouts/paystack-events")).json()) as { events: { alert: string | null }[] }
    expect(log.events[0]?.alert).toBe("amount_mismatch")
  })

  it("no answer from Paystack → pending; retry reuses the same reference; check settles it", async () => {
    let calls = 0
    const w = await world({
      transfer: async (_cfg, input) => {
        calls++
        if (calls === 1) throw new PaystackError("Paystack unreachable: timeout", null)
        return { transferCode: "TRF_y", reference: input.reference, status: "pending" }
      },
      verifyTransfer: async () => ({ status: "success", amount: 2790, transferCode: "TRF_y", reason: null }),
    })
    const first = await w.call("POST", "/admin/payouts", { sellerId: "seller-a" })
    expect(first.status).toBe(202)
    const body = (await first.json()) as PayoutBody
    expect(body.payout.status).toBe("pending")

    const retry = (await (await w.call("POST", `/admin/payouts/${body.payout.id}/retry`)).json()) as PayoutBody
    expect(retry.payout.status).toBe("processing")
    expect(w.references[0]).toBe(w.references[1])

    const checked = (await (await w.call("POST", `/admin/payouts/${body.payout.id}/check`)).json()) as PayoutBody
    expect(checked.payout.status).toBe("paid")
  })

  it("a definite Paystack 'no' fails the payout immediately", async () => {
    const w = await world({ transfer: async () => { throw new PaystackError("Your balance is not enough to fulfil this request", 400) } })
    const body = (await (await w.call("POST", "/admin/payouts", { sellerId: "seller-a" })).json()) as PayoutBody
    expect(body.outcome).toBe("failed")
    expect(body.payout.failureReason).toContain("balance")
    expect(await w.checkoutRepo.listDeliveredUnpaidOrders("seller-a")).toHaveLength(2)
  })
})

describe("checkouts are expired only after asking Paystack", () => {
  async function staleIntent(status: "pending" | "initiated" = "pending") {
    const snapshot = demoCatalog()
    const checkout = new InMemoryCheckoutRepository(snapshot)
    const cart = await checkout.createCart()
    await checkout.addCartItem(cart.id, "offer-a", 1)
    const quote = await checkout.quote(cart.id)
    const id = crypto.randomUUID()
    await checkout.createPaymentIntent({
      id, cartId: cart.id, method: "momo", status, amountPesewas: quote.totalPesewas, currency: "GHS",
      paystackReference: `ref_${id}`, buyerEmail: "b@t.test", momoProvider: null, momoPhone: null, shippingAddress: null,
    })
    const intent = (await checkout.getPaymentIntent(id))!
    return { checkout, intent: { ...intent, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }, amount: Number(quote.totalPesewas) }
  }
  const verifyAs = (status: string, amount: number) => async () => ({ status, amount, currency: "GHS", reference: "r", raw: {} })

  it("a paid buyer gets their order even if the webhook never came", async () => {
    const { checkout, intent, amount } = await staleIntent()
    const r = await reconcileStaleIntent(checkout, intent, { paystackSecretKey: SK, verify: verifyAs("success", amount) })
    expect(r).toBe("confirmed")
    expect(await checkout.getOrderGroupByPaymentIntent(intent.id)).not.toBeNull()
  })
  it("waits while the charge is still in progress", async () => {
    const { checkout, intent, amount } = await staleIntent()
    expect(await reconcileStaleIntent(checkout, intent, { paystackSecretKey: SK, verify: verifyAs("ongoing", amount) })).toBe("waiting")
    expect((await checkout.getPaymentIntent(intent.id))?.status).toBe("pending")
  })
  it("expires abandoned charges and ones Paystack never saw", async () => {
    const a = await staleIntent()
    expect(await reconcileStaleIntent(a.checkout, a.intent, { paystackSecretKey: SK, verify: verifyAs("abandoned", a.amount) })).toBe("expired")
    const b = await staleIntent()
    const notFound = async () => { throw new PaystackError("Transaction reference not found", 400) }
    expect(await reconcileStaleIntent(b.checkout, b.intent, { paystackSecretKey: SK, verify: notFound })).toBe("expired")
  })
  it("waits (doesn't expire) when Paystack is unreachable", async () => {
    const { checkout, intent } = await staleIntent()
    const down = async () => { throw new PaystackError("Paystack unreachable", null) }
    expect(await reconcileStaleIntent(checkout, intent, { paystackSecretKey: SK, verify: down })).toBe("waiting")
  })
})

describe("paid after the checkout closed", () => {
  it("acknowledges Paystack and raises an admin alert instead of retrying for 72h", async () => {
    const snapshot = demoCatalog()
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const cart = await checkoutRepo.createCart()
    await checkoutRepo.addCartItem(cart.id, "offer-a", 1)
    const quote = await checkoutRepo.quote(cart.id)
    const id = crypto.randomUUID()
    const reference = `ref_${id}`
    await checkoutRepo.createPaymentIntent({
      id, cartId: cart.id, method: "momo", status: "pending", amountPesewas: quote.totalPesewas, currency: "GHS",
      paystackReference: reference, buyerEmail: "b@t.test", momoProvider: null, momoPhone: null, shippingAddress: null,
    })
    await checkoutRepo.updatePaymentIntentStatus(id, "expired")
    const app = createApp({
      repo: new InMemoryCatalogRepository(snapshot),
      checkoutRepo,
      authRepo: new InMemoryAuthRepository(),
      jwtSecret: JWT,
      paystackSecretKey: SK,
      verifyPaystackTransaction: async () => ({ status: "success", amount: Number(quote.totalPesewas), currency: "GHS", reference, raw: {} }),
    })
    const raw = JSON.stringify({ event: "charge.success", data: { id: 99, reference, amount: Number(quote.totalPesewas), currency: "GHS" } })
    const res = await app.request("/hooks/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": createHmac("sha512", SK).update(raw).digest("hex"), "Content-Type": "application/json" },
      body: raw,
    })
    expect(res.status).toBe(200)
    const [event] = await checkoutRepo.listPaystackEvents()
    expect(event?.outcome).toBe("alert:paid_after_close")
    expect(await checkoutRepo.getOrderGroupByPaymentIntent(id)).toBeNull()
  })
})
