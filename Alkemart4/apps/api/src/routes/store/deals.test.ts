import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { signSessionJwt } from "../../lib/jwt"
import { resetRateLimits } from "../../middleware/security"

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"
const HOUR = 3_600_000

async function world() {
  resetRateLimits()
  const snapshot = demoCatalog()
  const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
  const authRepo = new InMemoryAuthRepository()
  await authRepo.registerVendor({ user: { id: "u-a", email: "a@t.test", passwordHash: await hashPassword("VendorPass1") }, seller: { id: "seller-a", handle: "seller-a-d", name: "Accra Mart" } })
  await authRepo.updateSellerStatus("seller-a", "open")
  await authRepo.createUser({ id: "buyer-1", email: "ama@t.test", passwordHash: await hashPassword("BuyerPass1"), role: "buyer" })
  await authRepo.createUser({ id: "buyer-2", email: "kofi@t.test", passwordHash: await hashPassword("BuyerPass1"), role: "buyer" })
  let clock = new Date()
  checkoutRepo.now = () => clock
  const app = createApp({ repo: new InMemoryCatalogRepository(snapshot), checkoutRepo, authRepo, jwtSecret: JWT })
  const tok = {
    buyer: await signSessionJwt({ userId: "buyer-1", role: "buyer" }, JWT),
    buyer2: await signSessionJwt({ userId: "buyer-2", role: "buyer" }, JWT),
    seller: await signSessionJwt({ userId: "u-a", role: "seller_member", sellerId: "seller-a" }, JWT),
  }
  const as = (who: keyof typeof tok | null) => async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { ...(who ? { Authorization: `Bearer ${tok[who]}` } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: res.status, body: (await res.json()) as Record<string, any> }
  }
  const offer = snapshot.offers.find((o) => o.id === "offer-a")!
  return { buyer: as("buyer"), buyer2: as("buyer2"), seller: as("seller"), anon: as(null), later: (h: number) => (clock = new Date(clock.getTime() + h * HOUR)), price: offer.pricePesewas }
}

// Make an offer is parked (routes not mounted). Un-skip when it comes back.
describe.skip("make an offer", () => {
  it("only negotiable listings take offers; the floor auto-declines and never leaks", async () => {
    const w = await world()
    const low = (w.price * 60n) / 100n
    expect((await w.buyer("POST", "/store/deals", { offerId: "offer-a", amountPesewas: low.toString() })).status).toBe(409)
    expect((await w.seller("PUT", "/vendor/deals/settings/offer-a", { negotiable: true, floorPesewas: w.price.toString() })).status).toBe(400)
    await w.seller("PUT", "/vendor/deals/settings/offer-a", { negotiable: true, floorPesewas: ((w.price * 80n) / 100n).toString() })
    expect((await w.anon("GET", "/store/deals/negotiable?offerIds=offer-a,offer-b")).body.negotiable).toEqual({ "offer-a": true, "offer-b": false })
    const r = await w.buyer("POST", "/store/deals", { offerId: "offer-a", amountPesewas: low.toString() })
    expect(r.status).toBe(201)
    expect(r.body.autoDeclined).toBe(true)
    expect(JSON.stringify(r.body)).not.toContain("floor")
    expect((await w.seller("GET", "/vendor/deals")).body.waitingOnYou).toBe(0)
  })

  it("seller counters, buyer accepts; the price applies at checkout for that buyer only, once", async () => {
    const w = await world()
    await w.seller("PUT", "/vendor/deals/settings/offer-a", { negotiable: true })
    const ask = (w.price * 85n) / 100n
    const d = (await w.buyer("POST", "/store/deals", { offerId: "offer-a", amountPesewas: ask.toString() })).body.deal
    expect(d.status).toBe("pending")
    const counter = (w.price * 90n) / 100n
    expect((await w.seller("POST", `/vendor/deals/${d.id}/counter`, { amountPesewas: counter.toString() })).body.deal.status).toBe("countered")
    expect((await w.buyer("POST", `/store/deals/${d.id}/accept`)).body.deal).toMatchObject({ status: "accepted", agreedPesewas: counter.toString() })

    // Another buyer's cart pays the list price.
    const cart2 = (await w.anon("POST", "/store/cart")).body.cartId
    await w.anon("POST", `/store/cart/${cart2}/items`, { offerId: "offer-a", qty: 1 })
    expect((await w.buyer2("GET", `/store/cart/${cart2}`)).body.items[0].unitPricePesewas).toBe(w.price.toString())

    const cart = (await w.anon("POST", "/store/cart")).body.cartId
    await w.anon("POST", `/store/cart/${cart}/items`, { offerId: "offer-a", qty: 1 })
    const view = await w.buyer("GET", `/store/cart/${cart}`)
    expect(view.body.items[0]).toMatchObject({ unitPricePesewas: counter.toString(), dealApplied: true })
    const addr = { first_name: "Ama", last_name: "T", phone: "0244000000", address_1: "Oxford St", city: "Accra", province: "Greater Accra", country_code: "gh" }
    const placed = await w.buyer("POST", "/store/checkout", { cartId: cart, buyerEmail: "ama@t.test", shippingAddress: addr, method: "cod" })
    expect(placed.status).toBe(200)
    const og = (await w.anon("POST", "/store/orders/lookup", { orderId: placed.body.orderGroupId, email: "ama@t.test" })).body.orderGroup
    expect(og.orders[0].items[0].unitPricePesewas).toBe(counter.toString())
    expect((await w.buyer("GET", "/store/deals")).body.items[0].status).toBe("used")
  })

  it("unanswered offers lapse; the accepted price expires", async () => {
    const w = await world()
    await w.seller("PUT", "/vendor/deals/settings/offer-a", { negotiable: true })
    const d = (await w.buyer("POST", "/store/deals", { offerId: "offer-a", amountPesewas: ((w.price * 85n) / 100n).toString() })).body.deal
    w.later(25)
    expect((await w.buyer("GET", "/store/deals")).body.items[0].status).toBe("expired")
    expect((await w.seller("POST", `/vendor/deals/${d.id}/accept`)).status).toBe(409)
  })
})
