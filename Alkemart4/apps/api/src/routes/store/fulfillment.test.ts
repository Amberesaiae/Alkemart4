/* eslint-disable @typescript-eslint/no-explicit-any */
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

resetRateLimits()
const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"

let buyerToken: string
const req = (method: string, body?: unknown, token: string = buyerToken): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

/** Seller A in Osu, Accra; delivers town GH₵30, region GH₵45, not beyond; offers pickup. */
async function setup() {
  resetRateLimits()
  const snapshot = demoCatalog()
  const authRepo = new InMemoryAuthRepository()
  buyerToken = await verifiedBuyerFixture(authRepo, JWT)
  const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
  await authRepo.createUser({ id: "admin-1", email: "ops@alkemart.test", passwordHash: await hashPassword("AdminPass1"), role: "admin" })
  await authRepo.registerVendor({
    user: { id: "u-a", email: "a@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
    seller: { id: "seller-a", handle: "seller-a", name: "Accra Mart" },
  })
  await authRepo.updateSellerStatus("seller-a", "open")
  await authRepo.markEmailVerified("u-a")
  const app = createApp({ repo: new InMemoryCatalogRepository(snapshot), checkoutRepo, authRepo, jwtSecret: JWT })
  const seller = await signSessionJwt({ userId: "u-a", role: "seller_member", sellerId: "seller-a" }, JWT)
  const admin = await signSessionJwt({ userId: "admin-1", role: "admin" }, JWT)

  const where = await app.request(
    "/vendor/sellers/me/address",
    req("POST", { pack_region: "GH07", city: "Accra", district: "Osu", address_1: "Blue gate, Oxford St", latitude: 5.556, longitude: -0.182 }, seller),
  )
  expect(where.status).toBe(200)
  const zones = await app.request(
    "/vendor/sellers/me/fulfillment",
    req("PATCH", { delivery: { town: "3000", region: "4500", country: null }, pickup: true }, seller),
  )
  expect(zones.status).toBe(200)

  const cart = await checkoutRepo.createCart()
  await checkoutRepo.addCartItem(cart.id, "offer-a", 1)
  return { app, checkoutRepo, authRepo, seller, admin, cartId: cart.id }
}

const address = (city: string, province: string, pin?: { latitude: number; longitude: number }) => ({
  first_name: "Ama",
  last_name: "Mensah",
  phone: "0244123456",
  address_1: "12 High St",
  city,
  province,
  country_code: "gh",
  ...pin,
})

describe("delivery options at checkout", () => {
  it("prices by where the buyer is and always offers pickup", async () => {
    const { app, cartId } = await setup()
    const town: any = await (await app.request(`/store/checkout/options?cartId=${cartId}&city=Accra&region=Greater%20Accra`)).json()
    expect(town.sellers[0].options).toEqual([
      { method: "delivery", zone: "town", label: "Delivery · same town", feePesewas: "3000" },
      { method: "pickup", zone: null, label: "Pick up in Osu, Accra, Greater Accra", feePesewas: "0" },
    ])
    const tema: any = await (await app.request(`/store/checkout/options?cartId=${cartId}&city=Tema&region=Greater%20Accra`)).json()
    expect(tema.sellers[0].options[0]).toMatchObject({ zone: "region", feePesewas: "4500" })
    const kumasi: any = await (await app.request(`/store/checkout/options?cartId=${cartId}&city=Kumasi&region=Ashanti`)).json()
    expect(kumasi.sellers[0].options.map((o: { method: string }) => o.method)).toEqual(["pickup"])
  })

  it("freezes the chosen fee on the order; pickup is free", async () => {
    const { app, checkoutRepo, cartId } = await setup()
    const res = await app.request(
      "/store/checkout",
      req("POST", { cartId, method: "cod", buyerEmail: "buyer@alkemart.test", shippingAddress: address("Tema", "Greater Accra"), fulfillment: { "seller-a": "pickup" } }),
    )
    expect(res.status).toBe(200)
    const { orders } = (await res.json()) as { orders: { id: string }[] }
    const order = (await checkoutRepo.getOrder(orders[0]!.id))!
    expect(order.fulfillmentMethod).toBe("pickup")
    expect(order.deliveryFeePesewas).toBe(0n)
    expect(order.handoverCode).toMatch(/^\d{4}$/)
  })

  it("charges the zone fee the server worked out, not the default", async () => {
    const { app, checkoutRepo, cartId } = await setup()
    const res = await app.request(
      "/store/checkout",
      req("POST", { cartId, method: "cod", buyerEmail: "buyer@alkemart.test", shippingAddress: address("Tema", "Greater Accra") }),
    )
    const { orders } = (await res.json()) as { orders: { id: string }[] }
    const order = (await checkoutRepo.getOrder(orders[0]!.id))!
    expect(order.fulfillmentMethod).toBe("delivery")
    expect(order.deliveryZone).toBe("region")
    expect(order.deliveryFeePesewas).toBe(4500n)
  })

  it("refuses delivery where the seller doesn't deliver, and says why", async () => {
    const { app, cartId } = await setup()
    const res = await app.request(
      "/store/checkout",
      req("POST", { cartId, method: "cod", buyerEmail: "buyer@alkemart.test", shippingAddress: address("Kumasi", "Ashanti"), fulfillment: { "seller-a": "delivery" } }),
    )
    expect(res.status).toBe(409)
    expect(await res.text()).toContain("doesn't deliver to your area")
  })

  it("shows the buyer their code and the pickup spot", async () => {
    const { app, cartId } = await setup()
    const res = await app.request(
      "/store/checkout",
      req("POST", { cartId, method: "cod", buyerEmail: "buyer@alkemart.test", shippingAddress: address("Accra", "Greater Accra"), fulfillment: { "seller-a": "pickup" } }),
    )
    const { orders } = (await res.json()) as { orders: { id: string }[] }
    const look = await app.request("/store/orders/lookup", req("POST", { orderId: orders[0]!.id, email: "buyer@alkemart.test" }))
    const o = ((await look.json()) as { orderGroup: { orders: Record<string, unknown>[] } }).orderGroup.orders[0]!
    expect(o.handoverCode).toMatch(/^\d{4}$/)
    expect(o.pickup).toMatchObject({ place: "Osu, Accra, Greater Accra", landmark: "Blue gate, Oxford St" })
  })
})

/** An online-paid (MoMo) order for seller A, confirmed as Paystack would. */
async function paidOrder(checkoutRepo: InMemoryCheckoutRepository, cartId: string, method: "delivery" | "pickup" = "delivery") {
  const intentId = crypto.randomUUID()
  // Pickup is free: the intent carries the fee the buyer actually pays.
  const quote = await checkoutRepo.quote(cartId, method === "pickup" ? new Map([["seller-a", 0n]]) : undefined)
  await checkoutRepo.createPaymentIntent({
    id: intentId,
    cartId,
    method: "momo",
    status: "pending",
    amountPesewas: quote.totalPesewas,
    currency: quote.currency,
    paystackReference: `ref_${intentId}`,
    buyerEmail: "buyer@alkemart.test",
    momoProvider: "mtn",
    momoPhone: "0244123456",
    shippingAddress: address("Accra", "Greater Accra"),
    ...(method === "pickup" ? { fulfillment: { "seller-a": { method: "pickup" as const, zone: null, feePesewas: "0" } } } : {}),
  })
  await checkoutRepo.updatePaymentIntentStatus(intentId, "succeeded")
  const { orders } = await checkoutRepo.confirmPaidOrder(intentId)
  return orders[0]!.id
}

const payable = async (repo: InMemoryCheckoutRepository) => (await repo.listDeliveredUnpaidOrders("seller-a")).map((o) => o.id)
const HOUR = 3600_000

describe("trust by default: sellers mark delivered, buyers can object", () => {
  it("seller's word alone: delivered at once, payout after the 48h report window", async () => {
    const { app, checkoutRepo, seller, cartId } = await setup()
    const orderId = await paidOrder(checkoutRepo, cartId)
    const res = await app.request(`/vendor/orders/${orderId}/deliver`, req("POST", {}, seller))
    expect(res.status).toBe(200)
    // The response already shows the wait, as stored.
    const { order } = (await res.json()) as { order: { deliveryConfirmedBy: string; payoutReleaseAt: string | null } }
    expect(order.deliveryConfirmedBy).toBe("seller")
    expect(Date.parse(order.payoutReleaseAt!)).toBeGreaterThan(Date.now() + 47 * HOUR)
    expect((await checkoutRepo.getOrder(orderId))!.deliveryConfirmedBy).toBe("seller")
    expect(await payable(checkoutRepo)).toEqual([])
    checkoutRepo.now = () => new Date(Date.now() + 49 * HOUR)
    expect(await payable(checkoutRepo)).toEqual([orderId])
  })

  it("with the buyer's code the payout is released at once", async () => {
    const { app, checkoutRepo, seller, cartId } = await setup()
    const orderId = await paidOrder(checkoutRepo, cartId)
    const code = (await checkoutRepo.getOrder(orderId))!.handoverCode!
    const res = await app.request(`/vendor/orders/${orderId}/deliver`, req("POST", { code }, seller))
    expect(res.status).toBe(200)
    // The answer says what was stored, so the seller sees "confirmed by code" at once.
    const { order } = (await res.json()) as { order: { deliveryConfirmedBy: string | null; payoutReleaseAt: string | null } }
    expect(order.deliveryConfirmedBy).toBe("buyer_code")
    // Released now, so there's no waiting time to show.
    expect(order.payoutReleaseAt).toBeNull()
    expect(await payable(checkoutRepo)).toEqual([orderId])
  })

  it("the buyer's 'I got it' releases it early, even after the seller marked it", async () => {
    const { app, checkoutRepo, seller, cartId } = await setup()
    const orderId = await paidOrder(checkoutRepo, cartId)
    await app.request(`/vendor/orders/${orderId}/deliver`, req("POST", {}, seller))
    const got = await app.request(`/store/orders/${orderId}/received`, req("POST", { email: "buyer@alkemart.test" }))
    expect(got.status).toBe(200)
    expect(await payable(checkoutRepo)).toEqual([orderId])
  })

  it("a delivery can't be confirmed before the seller sends it — confirming pays the seller", async () => {
    const { app, checkoutRepo, seller, cartId } = await setup()
    const orderId = await paidOrder(checkoutRepo, cartId)
    expect((await app.request(`/store/orders/${orderId}/received`, req("POST", { email: "buyer@alkemart.test" }))).status).toBe(409)
    expect((await checkoutRepo.getOrder(orderId))!.status).toBe("placed")
    expect(await payable(checkoutRepo)).toEqual([])
    expect((await app.request(`/vendor/orders/${orderId}/ship`, req("POST", {}, seller))).status).toBe(200)
    expect((await app.request(`/store/orders/${orderId}/received`, req("POST", { email: "buyer@alkemart.test" }))).status).toBe(200)
    expect((await checkoutRepo.getOrder(orderId))!.status).toBe("delivered")
    const events = await checkoutRepo.listOrderEvents([orderId])
    expect(events.at(-1)).toMatchObject({ status: "delivered", actor: "buyer" })
  })

  it("a pickup can be confirmed the moment the buyer collects it", async () => {
    const { app, checkoutRepo, cartId } = await setup()
    const orderId = await paidOrder(checkoutRepo, cartId, "pickup")
    expect((await checkoutRepo.getOrder(orderId))!.fulfillmentMethod).toBe("pickup")
    expect((await app.request(`/store/orders/${orderId}/received`, req("POST", { email: "buyer@alkemart.test" }))).status).toBe(200)
    expect((await checkoutRepo.getOrder(orderId))!.status).toBe("delivered")
  })

  it("a reported problem holds only that order until the buyer says it's sorted", async () => {
    const { app, checkoutRepo, cartId } = await setup()
    const orderId = await paidOrder(checkoutRepo, cartId, "pickup")
    await app.request(`/store/orders/${orderId}/received`, req("POST", { email: "buyer@alkemart.test" }))
    expect((await app.request(`/store/orders/${orderId}/problem`, req("POST", { email: "buyer@alkemart.test", note: "Screen is cracked" }))).status).toBe(200)
    expect(await payable(checkoutRepo)).toEqual([])
    expect((await app.request(`/store/orders/${orderId}/problem/resolved`, req("POST", { email: "buyer@alkemart.test" }))).status).toBe(200)
    expect(await payable(checkoutRepo)).toEqual([orderId])
  })

  it("only the buyer can confirm or report", async () => {
    const { app, checkoutRepo, cartId, authRepo } = await setup()
    const stranger = await verifiedBuyerFixture(authRepo, JWT, "someone@else.test")
    const orderId = await paidOrder(checkoutRepo, cartId)
    expect((await app.request(`/store/orders/${orderId}/received`, req("POST", { email: "buyer@alkemart.test" }, stranger))).status).toBe(404)
    expect((await app.request(`/store/orders/${orderId}/problem`, req("POST", { note: "Not mine but angry" }, stranger))).status).toBe(404)
  })

  it("stops checking codes after five wrong tries, but never blocks the seller", async () => {
    const { app, checkoutRepo, seller, cartId } = await setup()
    const orderId = await paidOrder(checkoutRepo, cartId)
    const code = (await checkoutRepo.getOrder(orderId))!.handoverCode!
    const wrong = code === "9999" ? "0000" : "9999"
    for (let i = 0; i < 5; i++) {
      expect((await app.request(`/vendor/orders/${orderId}/deliver`, req("POST", { code: wrong }, seller))).status).toBe(422)
    }
    expect((await app.request(`/vendor/orders/${orderId}/deliver`, req("POST", { code }, seller))).status).toBe(423)
    expect((await app.request(`/vendor/orders/${orderId}/deliver`, req("POST", {}, seller))).status).toBe(200)
    expect((await checkoutRepo.getOrder(orderId))!.deliveryConfirmedBy).toBe("seller")
  })
})

describe("seller settings are merged, never wiped", () => {
  it("saving only the delivery fee keeps the address, pin and zones", async () => {
    const { app, seller } = await setup()
    const fee = await app.request("/vendor/sellers/me/address", req("POST", { delivery_fee_pesewas: "2500" }, seller))
    expect(fee.status).toBe(200)
    const s = ((await fee.json()) as { seller: { address: Record<string, unknown>; fulfillment: unknown } }).seller
    expect(s.address).toMatchObject({ city: "Accra", district: "Osu", address_1: "Blue gate, Oxford St", latitude: 5.556, longitude: -0.182 })
    expect(s.fulfillment).toEqual({ delivery: { town: "3000", region: "4500", country: null }, pickup: true })
  })

  it("won't let a seller switch off every way to get an order", async () => {
    const { app, seller } = await setup()
    const res = await app.request(
      "/vendor/sellers/me/fulfillment",
      req("PATCH", { delivery: { town: null, region: null, country: null }, pickup: false }, seller),
    )
    expect(res.status).toBe(400)
  })
})

describe("delivery policy is admin-tunable", () => {
  it("admin shortens the report window; the next delivery uses it", async () => {
    const { app, checkoutRepo, seller, admin, cartId } = await setup()
    const bad = await app.request("/admin/settings/delivery-policy", req("PUT", { sameTownKm: 0 }, admin))
    expect(bad.status).toBe(400)
    const put = await app.request("/admin/settings/delivery-policy", req("PUT", { reportWindowHours: { sameDay: 2, multiDay: 6 } }, admin))
    expect(put.status).toBe(200)
    const got = await (await app.request("/admin/settings/delivery-policy", req("GET", undefined, admin))).json()
    expect((got as { policy: { reportWindowHours: unknown } }).policy.reportWindowHours).toEqual({ sameDay: 2, multiDay: 6 })

    const orderId = await paidOrder(checkoutRepo, cartId)
    await app.request(`/vendor/orders/${orderId}/deliver`, req("POST", {}, seller))
    checkoutRepo.now = () => new Date(Date.now() + 7 * HOUR)
    expect(await payable(checkoutRepo)).toEqual([orderId])
  })

  it("sellers can't change it", async () => {
    const { app, seller } = await setup()
    expect((await app.request("/admin/settings/delivery-policy", req("PUT", { sameTownKm: 50 }, seller))).status).toBe(403)
  })
})

describe("in-memory seller store matches Postgres", () => {
  it("an address save without a fee keeps the fee", async () => {
    const { app, seller, authRepo } = await setup()
    await authRepo.updateSellerAddress("seller-a", { deliveryFeePesewas: 2500n })
    await app.request("/vendor/sellers/me/address", req("POST", { city: "Accra" }, seller))
    expect((await authRepo.findSellerById("seller-a"))!.deliveryFeePesewas).toBe(2500n)
  })
})
