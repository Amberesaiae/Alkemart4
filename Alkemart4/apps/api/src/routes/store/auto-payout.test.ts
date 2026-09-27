import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { consumeJobMessage, type JobMessage } from "../../jobs"
import { autoPaySeller } from "../../lib/payouts"
import { signSessionJwt } from "../../lib/jwt"
import { resetRateLimits } from "../../middleware/security"
import type { InMemorySmsProvider } from "../../sms"
resetRateLimits()

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"
const BUYER = "buyer@t.test"
const HOUR = 3_600_000

/** One seller with a MoMo payout account and one shipped, paid-online order. */
async function world() {
  resetRateLimits()
  const snapshot = demoCatalog()
  const catalog = new InMemoryCatalogRepository(snapshot)
  const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
  const authRepo = new InMemoryAuthRepository()
  await authRepo.registerVendor({
    user: { id: "u-seller-a", email: "seller-a@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
    seller: { id: "seller-a", handle: "seller-a-auto", name: "Accra Mart" },
  })
  await authRepo.updateSellerStatus("seller-a", "open")
  await authRepo.updateSellerGhanaSetup("seller-a", {
    name: "Accra Mart", packRegion: "greater_accra", digitalAddress: null, deliveryFeePesewas: 500n, momoProvider: "mtn", momoPhone: "0244123456", recipientCode: "RCP_test",
  })
  await authRepo.updateSellerCommission("seller-a", 700)

  const cart = await checkoutRepo.createCart()
  await checkoutRepo.addCartItem(cart.id, "offer-a", 1)
  const intentId = crypto.randomUUID()
  await checkoutRepo.createPaymentIntent({
    id: intentId, cartId: cart.id, method: "momo", status: "initiated", amountPesewas: (await checkoutRepo.quote(cart.id)).totalPesewas, currency: "GHS",
    paystackReference: "ref_charge_auto", buyerEmail: BUYER, momoProvider: null, momoPhone: null, shippingAddress: null,
  })
  const order = (await checkoutRepo.confirmPaidOrder(intentId)).orders[0]!
  await checkoutRepo.updateOrderStatus(order.id, "seller-a", "shipped")

  const transfers: string[] = []
  const published: { msg: JobMessage; delaySeconds?: number }[] = []
  const transfer = async (_cfg: unknown, input: { reference: string }) => {
    transfers.push(input.reference)
    return { transferCode: "TRF_auto", reference: input.reference, status: "pending" }
  }
  const app = createApp({
    repo: catalog,
    checkoutRepo,
    authRepo,
    jwtSecret: JWT,
    paystackSecretKey: "sk_test_auto",
    createPaystackTransfer: transfer,
    jobs: { publish: async (_q, msg, opts) => void published.push({ msg, delaySeconds: opts?.delaySeconds }) },
  })
  const sellerToken = await signSessionJwt({ userId: "u-seller-a", role: "seller_member", sellerId: "seller-a" }, JWT)
  const call = (token: string | null) => async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return { status: res.status, body: (await res.json()) as Record<string, unknown> }
  }
  const payouts = () => checkoutRepo.listPayoutsForSeller("seller-a")
  return { checkoutRepo, authRepo, orderId: order.id, transfers, published, transfer, buyer: call(null), seller: call(sellerToken), payouts }
}

// Automatic payouts are off for the pilot (DEFAULT_PAYOUT_POLICY.autoPayout = false).
// Turn the policy on and un-skip this suite when the owner switches them on.
describe.skip("automatic payouts", () => {
  it("pays the seller as soon as the buyer says they got it — once", async () => {
    const w = await world()
    expect((await w.buyer("POST", `/store/orders/${w.orderId}/received`, { email: BUYER })).status).toBe(200)
    const [p] = await w.payouts()
    expect(p).toMatchObject({ status: "processing", netPesewas: 1395n, createdBy: "system:auto" })
    // A second release moment never sends twice.
    await w.buyer("POST", `/store/orders/${w.orderId}/received`, { email: BUYER })
    expect(w.transfers).toHaveLength(1)
  })

  it("pays when the handover code is entered", async () => {
    const w = await world()
    const code = (await w.checkoutRepo.getOrder(w.orderId))!.handoverCode!
    expect((await w.seller("POST", `/vendor/orders/${w.orderId}/deliver`, { code })).status).toBe(200)
    expect(await w.payouts()).toHaveLength(1)
    expect(w.published).toHaveLength(0)
  })

  it("on the seller's word alone, waits out the report window, then pays", async () => {
    const w = await world()
    expect((await w.seller("POST", `/vendor/orders/${w.orderId}/deliver`, {})).status).toBe(200)
    expect(await w.payouts()).toHaveLength(0)
    const [job] = w.published
    expect(job?.msg.kind).toBe("auto-payout")
    expect(job?.delaySeconds).toBeGreaterThan(0)

    const deps = { checkout: w.checkoutRepo, sms: {} as InMemorySmsProvider, autoPay: (id: string) => autoPaySeller({ checkout: w.checkoutRepo, authRepo: w.authRepo, secretKey: "sk_test_auto", transfer: w.transfer }, id) }
    const acks = { ack: 0, retry: 0 }
    const handle = { attempts: 1, ack: () => void acks.ack++, retry: () => void acks.retry++ }
    // Too early: comes back later, nothing paid.
    await consumeJobMessage(deps, job!.msg, handle)
    expect(acks.retry).toBe(1)
    expect(await w.payouts()).toHaveLength(0)
    // Window over (no report): paid.
    const after = Date.now() + 72 * HOUR
    w.checkoutRepo.now = () => new Date(after)
    await consumeJobMessage({ ...deps, nowMs: after }, job!.msg, handle)
    expect(acks.ack).toBe(1)
    expect(await w.payouts()).toHaveLength(1)
  })

  it("holds while the buyer reports a problem; pays when they say it's sorted", async () => {
    const w = await world()
    await w.seller("POST", `/vendor/orders/${w.orderId}/deliver`, {})
    await w.buyer("POST", `/store/orders/${w.orderId}/problem`, { email: BUYER, note: "The screen is cracked" })
    const after = Date.now() + 72 * HOUR
    w.checkoutRepo.now = () => new Date(after)
    // The seller's money page is a backstop trigger; the held order isn't paid.
    await w.seller("GET", "/vendor/payouts/statement")
    expect(await w.payouts()).toHaveLength(0)
    await w.buyer("POST", `/store/orders/${w.orderId}/problem/resolved`, { email: BUYER })
    expect(await w.payouts()).toHaveLength(1)
  })
})
