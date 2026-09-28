import { createHmac } from "node:crypto"
import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { signSessionJwt } from "../../lib/jwt"
import { verifiedBuyerFixture } from "../../lib/verified-buyer-fixture"
import { resetRateLimits } from "../../middleware/security"
import { InMemoryShopPolicyStore } from "../../shop-policies"
resetRateLimits()

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"
const SK = "sk_test_returns"
const BUYER = "buyer@t.test"
const HOUR = 3_600_000

type Case = {
  id: string
  status: string
  outcome: string | null
  waitingOn: string | null
  refund: { amountPesewas: string; via: string; status: string } | null
  sellerRecoveryPesewas?: string
}

/** One seller (7% commission), one delivered order of GH₵15.00 (1500), paid by MoMo or cash. */
async function world(opts: { method?: "momo" | "cod"; returnsDays?: number; sellerOnly?: boolean } = {}) {
  resetRateLimits()
  const snapshot = demoCatalog()
  const catalog = new InMemoryCatalogRepository(snapshot)
  const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
  const authRepo = new InMemoryAuthRepository()
  const buyerToken = await verifiedBuyerFixture(authRepo, JWT, BUYER)
  const policyStore = new InMemoryShopPolicyStore()
  await authRepo.registerVendor({
    user: { id: "u-seller-a", email: "seller-a@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
    seller: { id: "seller-a", handle: "seller-a-ret", name: "Accra Mart" },
  })
  await authRepo.updateSellerStatus("seller-a", "open")
  await authRepo.markEmailVerified("u-seller-a")
  await authRepo.updateSellerGhanaSetup("seller-a", {
    name: "Accra Mart", packRegion: "greater_accra", digitalAddress: null, deliveryFeePesewas: 500n, momoProvider: "mtn", momoPhone: "0244123456", recipientCode: "RCP_test",
  })
  await authRepo.updateSellerCommission("seller-a", 700)
  await authRepo.createUser({ id: "admin-1", email: "admin@alkemart.test", passwordHash: await hashPassword("AdminPass1"), role: "admin" })
  if (opts.returnsDays !== undefined) await policyStore.savePolicy("seller-a", { returnsDays: opts.returnsDays })

  // Placed after the shop saved its policy, so that version is the one in force.
  const t0 = new Date(Date.now() + 60_000)
  checkoutRepo.now = () => t0
  const cart = await checkoutRepo.createCart()
  await checkoutRepo.addCartItem(cart.id, "offer-a", 1)
  const quote = await checkoutRepo.quote(cart.id)
  const intentId = crypto.randomUUID()
  const method = opts.method ?? "momo"
  await checkoutRepo.createPaymentIntent({
    id: intentId, cartId: cart.id, method, status: method === "cod" ? "pending" : "initiated", amountPesewas: quote.totalPesewas, currency: "GHS",
    paystackReference: method === "cod" ? null : "ref_charge_1", buyerEmail: BUYER, momoProvider: null, momoPhone: null, shippingAddress: null,
  })
  const { orders } = await checkoutRepo.confirmPaidOrder(intentId)
  const orderId = orders[0]!.id
  await checkoutRepo.updateOrderStatus(orderId, "seller-a", "shipped")
  await checkoutRepo.updateOrderStatus(orderId, "seller-a", "delivered")
  await checkoutRepo.recordDeliveryConfirmation(orderId, opts.sellerOnly ? "seller" : "buyer_code", t0)
  let clock = new Date(t0.getTime() + HOUR)
  checkoutRepo.now = () => clock
  const later = (hours: number) => {
    clock = new Date(clock.getTime() + hours * HOUR)
  }

  const refunds: { reference: string; amountMinor?: bigint }[] = []
  const app = createApp({
    repo: catalog,
    checkoutRepo,
    authRepo,
    policyStore,
    jwtSecret: JWT,
    paystackSecretKey: SK,
    createPaystackTransfer: async (_cfg, input) => ({ transferCode: "TRF_x", reference: input.reference, status: "pending" }),
    refundPaystackTransaction: async (_cfg, input) => {
      refunds.push(input)
      return { status: "pending", refundId: `RF_${refunds.length}` }
    },
  })
  const adminToken = await signSessionJwt({ userId: "admin-1", role: "admin" }, JWT)
  const sellerToken = await signSessionJwt({ userId: "u-seller-a", role: "seller_member", sellerId: "seller-a" }, JWT)
  const req = (token: string | null) => async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return { status: res.status, body: (await res.json()) as Record<string, unknown> }
  }
  const buyer = req(buyerToken)
  const stranger = req(await verifiedBuyerFixture(authRepo, JWT, "someone@else.test"))
  const seller = req(sellerToken)
  const admin = req(adminToken)
  const ask = (body: Record<string, unknown>) => buyer("POST", `/store/orders/${orderId}/return`, { email: BUYER, ...body })
  const hook = (payload: unknown) => {
    const raw = JSON.stringify(payload)
    return app.request("/hooks/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": createHmac("sha512", SK).update(raw).digest("hex"), "Content-Type": "application/json" },
      body: raw,
    })
  }
  return { app, authRepo, checkoutRepo, orderId, groupId: orders[0]!.orderGroupId, refunds, buyer, stranger, seller, admin, ask, later, hook }
}

const caseOf = (r: { body: Record<string, unknown> }) => r.body.returnCase as Case

describe("returns: buyer asks, seller answers", () => {
  it("shows what the buyer can ask for on the order", async () => {
    const w = await world({ returnsDays: 3 })
    const r = await w.buyer("POST", "/store/orders/lookup", { orderId: w.groupId, email: BUYER })
    const so = (r.body.orderGroup as { orders: { returnOptions: { reasons: { reason: string }[]; refundablePesewas: string } | null }[] }).orders[0]!
    expect(so.returnOptions?.reasons.map((x) => x.reason)).toEqual(["damaged", "wrong_item", "not_as_described", "changed_mind"])
    expect(so.returnOptions?.refundablePesewas).toBe("1500")
  })

  it("a paid card order reads as paid", async () => {
    const w = await world({ sellerOnly: true })
    const r = await w.buyer("POST", "/store/orders/lookup", { orderId: w.groupId, email: BUYER })
    expect((r.body.orderGroup as { paymentStatus: string }).paymentStatus).toBe("captured")
  })

  it("seller refunds → Paystack refund of the items, payout holds then drops the order", async () => {
    const w = await world()
    const opened = await w.ask({ reason: "damaged", wish: "refund", note: "Screen is cracked" })
    expect(opened.status).toBe(201)
    expect(caseOf(opened).waitingOn).toBe("seller")
    // Payout waits while the case is open.
    const blocked = await w.admin("POST", "/admin/payouts", { sellerId: "seller-a" })
    expect(blocked.status).toBe(400)

    const accepted = await w.seller("POST", `/vendor/returns/${caseOf(opened).id}/refund`)
    expect(accepted.status).toBe(200)
    expect(caseOf(accepted)).toMatchObject({ status: "closed", outcome: "refund", refund: { amountPesewas: "1500", via: "provider", status: "pending" } })
    expect(w.refunds).toEqual([{ reference: "ref_charge_1", amountMinor: 1500n }])
    // Nothing left to pay out.
    expect((await w.admin("POST", "/admin/payouts", { sellerId: "seller-a" })).status).toBe(400)
    // The seller's statement says it was refunded, not "next payout".
    const money = await w.seller("GET", "/vendor/payouts/statement")
    const line = (money.body.lines as { state: string; netPesewas: string }[])[0]!
    expect(line).toMatchObject({ state: "refunded", netPesewas: "0" })
    expect((money.body.totals as { pendingNetPesewas: string; pendingGrossPesewas: string })).toMatchObject({ pendingNetPesewas: "0", pendingGrossPesewas: "0" })

    // Paystack confirms → paid.
    await w.hook({ event: "refund.processed", data: { id: "RF_1", status: "processed", transaction_reference: "ref_charge_1", amount: 1500 } })
    const detail = await w.admin("GET", `/admin/returns/${caseOf(opened).id}`)
    expect((detail.body.returnCase as Case).refund?.status).toBe("paid")
  })

  it("seller sends a replacement: no money moves, the payout continues", async () => {
    const w = await world()
    const id = caseOf(await w.ask({ reason: "wrong_item", wish: "swap", note: "Sent the blue one" })).id
    const r = await w.seller("POST", `/vendor/returns/${id}/replace`)
    expect(caseOf(r)).toMatchObject({ status: "closed", outcome: "swap", refund: null })
    expect(w.refunds).toHaveLength(0)
    expect((await w.admin("POST", "/admin/payouts", { sellerId: "seller-a" })).status).toBe(200)
  })

  it("decline → buyer escalates → admin decides; audit-logged", async () => {
    const w = await world()
    const id = caseOf(await w.ask({ reason: "damaged", wish: "refund", note: "Won't turn on" })).id
    expect((await w.seller("POST", `/vendor/returns/${id}/decline`, { reason: "no" })).status).toBe(409)
    await w.seller("POST", `/vendor/returns/${id}/decline`, { reason: "It worked when it left the shop" })
    // Admin can't decide before it's escalated.
    expect((await w.admin("POST", `/admin/returns/${id}/decide`, { outcome: "refund", note: "Refund it" })).status).toBe(409)
    await w.buyer("POST", `/store/orders/${w.orderId}/return/respond`, { email: BUYER, action: "escalate" })
    const queue = await w.admin("GET", "/admin/returns?view=decide")
    expect((queue.body.items as Case[]).map((c) => c.id)).toEqual([id])
    // Admin chooses only full refund or side with the seller.
    expect((await w.admin("POST", `/admin/returns/${id}/decide`, { outcome: "partial_refund", amountPesewas: "700", note: "Half back" })).status).toBe(400)
    const decided = await w.admin("POST", `/admin/returns/${id}/decide`, { outcome: "refund", note: "Photos show a crack on arrival" })
    expect(decided.status).toBe(200)
    expect((decided.body.returnCase as Case).refund?.amountPesewas).toBe("1500")
  })

  it("a silent seller goes to admin once the reply time passes", async () => {
    const w = await world()
    const id = caseOf(await w.ask({ reason: "wrong_item", wish: "swap", note: "Sent the blue one" })).id
    expect((await w.buyer("POST", `/store/orders/${w.orderId}/return/respond`, { email: BUYER, action: "escalate" })).status).toBe(409)
    w.later(49)
    const list = await w.admin("GET", "/admin/returns?view=decide")
    expect((list.body.items as Case[]).map((c) => c.id)).toEqual([id])
  })

  it("already paid out: refund goes to the buyer, the seller's share comes off the next payout", async () => {
    const w = await world()
    const first = await w.admin("POST", "/admin/payouts", { sellerId: "seller-a" })
    expect((first.body.payout as { netPesewas: string }).netPesewas).toBe("1395")
    const id = caseOf(await w.ask({ reason: "damaged", wish: "refund", note: "Battery swollen" })).id
    const accepted = await w.seller("POST", `/vendor/returns/${id}/refund`)
    // 1500 − 7% commission given back by the platform (105) = 1395 from the seller.
    expect(caseOf(accepted).sellerRecoveryPesewas).toBe("1395")
    const money = await w.seller("GET", "/vendor/payouts/statement")
    expect((money.body.totals as { refundsToRecoverPesewas: string }).refundsToRecoverPesewas).toBe("1395")
  })

  it("pay on delivery: the seller pays back and records it", async () => {
    const w = await world({ method: "cod" })
    const id = caseOf(await w.ask({ reason: "damaged", wish: "refund", note: "Box was crushed" })).id
    const back = await w.seller("POST", `/vendor/returns/${id}/refund`)
    expect(caseOf(back).refund).toMatchObject({ via: "seller", status: "owed", amountPesewas: "1500" })
    expect(w.refunds).toHaveLength(0)
    const paid = await w.seller("POST", `/vendor/returns/${id}/refund-paid`)
    expect(caseOf(paid).refund?.status).toBe("paid")
  })

  it("respects the shop's window and one open case per order", async () => {
    const w = await world({ returnsDays: 0 })
    const no = await w.ask({ reason: "changed_mind", wish: "refund", note: "Don't need it now" })
    expect(no.status).toBe(409)
    expect(String(no.body.message ?? no.body.error)).toMatch(/doesn't take returns/)
    expect((await w.ask({ reason: "damaged", wish: "refund", note: "Cracked screen" })).status).toBe(201)
    expect((await w.ask({ reason: "damaged", wish: "refund", note: "Cracked screen" })).status).toBe(409)
    // "It's sorted" withdraws the case and releases the payout.
    await w.buyer("POST", `/store/orders/${w.orderId}/problem/resolved`, { email: BUYER })
    expect((await w.admin("POST", "/admin/payouts", { sellerId: "seller-a" })).status).toBe(200)
  })

  it("Buyer Protection shows the faulty-item window; a decline waits for the buyer (no deadline)", async () => {
    const w = await world()
    expect((await w.buyer("GET", "/store/protection")).body).toMatchObject({ faultReturnDays: 7 })
    const id = caseOf(await w.ask({ reason: "damaged", wish: "refund", note: "Cracked screen" })).id
    await w.seller("POST", `/vendor/returns/${id}/decline`, { reason: "Sealed when it left" })
    w.later(24 * 30)
    const still = await w.admin("GET", `/admin/returns/${id}`)
    expect((still.body.returnCase as Case).status).toBe("declined")
    await w.buyer("POST", `/store/orders/${w.orderId}/return/respond`, { email: BUYER, action: "escalate" })
    expect((await w.admin("POST", `/admin/returns/${id}/decide`, { outcome: "declined", note: "No photos of damage" })).status).toBe(200)
  })

  it("another seller can't touch the case; strangers can't open one", async () => {
    const w = await world()
    await w.authRepo.registerVendor({
      user: { id: "u-x", email: "other-seller@example.test", passwordHash: await hashPassword("Local-only-test-pass") },
      seller: { id: "seller-b", handle: "other-shop", name: "Other shop" },
    })
    const id = caseOf(await w.ask({ reason: "damaged", wish: "refund", note: "Cracked screen" })).id
    const other = await signSessionJwt({ userId: "u-x", role: "seller_member", sellerId: "seller-b" }, JWT)
    const res = await w.app.request(`/vendor/returns/${id}/refund`, { method: "POST", headers: { Authorization: `Bearer ${other}`, "Content-Type": "application/json" }, body: "{}" })
    expect(res.status).toBe(404)
    const stranger = await w.stranger("POST", `/store/orders/${w.orderId}/return`, { email: BUYER, reason: "damaged", wish: "refund", note: "Cracked screen" })
    expect(stranger.status).toBe(404)
  })
})
