/* eslint-disable @typescript-eslint/no-explicit-any */
import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { signSessionJwt } from "../../lib/jwt"
import { resetRateLimits } from "../../middleware/security"
import { InMemoryStatementStore } from "../../statement-store"

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"
const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })

async function setup() {
  resetRateLimits()
  const snapshot = demoCatalog()
  const authRepo = new InMemoryAuthRepository()
  const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
  const statementStore = new InMemoryStatementStore()
  for (const id of ["seller-a", "seller-b"]) {
    await authRepo.registerVendor({
      user: { id: `u-${id}`, email: `${id}@x.test`, passwordHash: await hashPassword("VendorPass1") },
      seller: { id, handle: id, name: id === "seller-a" ? "Accra Mart" : "Kumasi Tech" },
    })
    await authRepo.updateSellerStatus(id, "open")
  }
  await authRepo.createUser({ id: "admin-1", email: "ops@x.test", passwordHash: await hashPassword("AdminPass1"), role: "admin" })
  const app = createApp({ repo: new InMemoryCatalogRepository(snapshot), checkoutRepo, authRepo, jwtSecret: JWT, statementStore })
  const sellerA = await signSessionJwt({ userId: "u-seller-a", role: "seller_member", sellerId: "seller-a" }, JWT)
  const admin = await signSessionJwt({ userId: "admin-1", role: "admin" }, JWT)

  /** A paid-online order for `offerId`, delivered at `at` (the in-memory clock). */
  const order = async (offerId: string, at: Date, opts: { deliver?: boolean; method?: "momo" | "cod"; email?: string } = {}) => {
    checkoutRepo.now = () => at
    const cart = await checkoutRepo.createCart()
    await checkoutRepo.addCartItem(cart.id, offerId, 1)
    const quote = await checkoutRepo.quote(cart.id)
    const id = crypto.randomUUID()
    await checkoutRepo.createPaymentIntent({
      id, cartId: cart.id, method: opts.method ?? "momo", status: "pending", amountPesewas: quote.totalPesewas, currency: "GHS",
      paystackReference: `r_${id}`, buyerEmail: opts.email ?? "ama@x.test", momoProvider: null, momoPhone: null,
      shippingAddress: { first_name: "A", last_name: "B", phone: "0244000000", address_1: "x", city: "Accra", province: "Greater Accra", country_code: "gh" },
    })
    const { orders } = await checkoutRepo.confirmPaidOrder(id)
    const o = orders[0]!
    if (opts.deliver !== false) {
      await checkoutRepo.updateOrderStatus(o.id, o.sellerId, "shipped")
      await checkoutRepo.updateOrderStatus(o.id, o.sellerId, "delivered")
    }
    checkoutRepo.now = () => new Date()
    return o
  }
  return { app, checkoutRepo, statementStore, sellerA, admin, order }
}

const lastMonth = () => {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 10, 12))
}
const periodOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`

describe("business overview", () => {
  it("a seller sees only their own shop, with the previous period to compare", async () => {
    const { app, sellerA, order } = await setup()
    const now = new Date()
    await order("offer-a", new Date(now.getTime() - 2 * 86_400_000))
    await order("offer-a", new Date(now.getTime() - 3 * 86_400_000), { email: "kofi@x.test" })
    await order("offer-a", new Date(now.getTime() - 10 * 86_400_000)) // previous 7 days
    await order("offer-b", new Date(now.getTime() - 2 * 86_400_000)) // seller-b
    const res = await app.request("/vendor/business/overview?preset=7d", auth(sellerA))
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.range.label).toBe("Last 7 days")
    expect(body.current.orders).toBe(2)
    expect(body.current.buyers).toBe(2)
    expect(body.current.sellers.map((s: { sellerId: string }) => s.sellerId)).toEqual(["seller-a"])
    expect(body.previousTotals.orders).toBe(1)
    expect(body.compare.orders).toBe(1) // +100%
    expect(body.current.series).toHaveLength(7)
  })

  it("custom dates and years; bad ranges answer in plain words", async () => {
    const { app, sellerA } = await setup()
    const y = new Date().getUTCFullYear() - 1
    expect(((await (await app.request(`/vendor/business/overview?year=${y}`, auth(sellerA))).json()) as any).range.label).toBe(String(y))
    const bad = await app.request("/vendor/business/overview?from=2026-03-01&to=2026-01-01", auth(sellerA))
    expect(bad.status).toBe(400)
  })

  it("admin sees the platform, or one seller with ?sellerId", async () => {
    const { app, admin, order } = await setup()
    await order("offer-a", new Date(Date.now() - 86_400_000))
    await order("offer-b", new Date(Date.now() - 86_400_000))
    const all = (await (await app.request("/admin/business/overview?preset=30d", auth(admin))).json()) as any
    expect(all.current.orders).toBe(2)
    expect(all.current.activeSellers).toBe(2)
    expect(all.current.sellers.map((s: { name: string }) => s.name).sort()).toEqual(["Accra Mart", "Kumasi Tech"])
    const one = (await (await app.request("/admin/business/overview?preset=30d&sellerId=seller-b", auth(admin))).json()) as any
    expect([one.current.orders, one.sellerName]).toEqual([1, "Kumasi Tech"])
  })

  it("exports the orders behind the numbers as a CSV file", async () => {
    const { app, sellerA, order } = await setup()
    await order("offer-a", new Date(Date.now() - 86_400_000))
    const res = await app.request("/vendor/business/orders.csv?preset=30d", auth(sellerA))
    expect(res.headers.get("content-type")).toContain("text/csv")
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="seller-a-orders-.*\.csv"/)
    const text = await res.text()
    expect(text.split("\n")[1]).toContain("delivered")
    expect(text).not.toContain("ama@x.test") // no buyer emails in exports
  })
})

describe("monthly statements", () => {
  it("freezes a past month once, with a fingerprint anyone can check", async () => {
    const { app, sellerA, order } = await setup()
    await order("offer-a", lastMonth())
    await order("offer-a", lastMonth(), { method: "cod" })
    const period = periodOf(lastMonth())
    const first = (await (await app.request(`/vendor/business/statements/${period}`, auth(sellerA))).json()) as any
    expect(first.statement).toMatchObject({ period, status: "closed", verified: true })
    expect(first.statement.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(first.statement.data.totals.deliveredOrders).toBe(2)

    // A late order for that month can't change it: it's already closed.
    await order("offer-a", lastMonth())
    const again = (await (await app.request(`/vendor/business/statements/${period}`, auth(sellerA))).json()) as any
    expect(again.statement.hash).toBe(first.statement.hash)
    expect(again.statement.closedAt).toBe(first.statement.closedAt)
    expect(again.statement.data.totals.deliveredOrders).toBe(2)
  })

  it("this month is a live preview, not stored", async () => {
    const { app, sellerA, statementStore, order } = await setup()
    await order("offer-a", new Date())
    const now = periodOf(new Date())
    const st = (await (await app.request(`/vendor/business/statements/${now}`, auth(sellerA))).json()) as any
    expect(st.statement).toMatchObject({ status: "open", hash: null })
    expect(await statementStore.get("seller", "seller-a", now)).toBeNull()
  })

  it("flags a stored statement that was edited behind our back", async () => {
    const { app, sellerA, statementStore, order } = await setup()
    await order("offer-a", lastMonth())
    const period = periodOf(lastMonth())
    await app.request(`/vendor/business/statements/${period}`, auth(sellerA))
    const stored = (await statementStore.get("seller", "seller-a", period))!
    ;(statementStore as unknown as { rows: Map<string, { data: { totals: { salesPesewas: string } } }> }).rows.get(`seller|seller-a|${period}`)!.data.totals.salesPesewas = "1"
    const st = (await (await app.request(`/vendor/business/statements/${period}`, auth(sellerA))).json()) as any
    expect(st.statement.verified).toBe(false)
    expect(stored.hash).toBe(st.statement.hash)
  })

  it("lists months since joining, downloads CSV; refuses future months", async () => {
    const { app, sellerA, admin, order } = await setup()
    await order("offer-a", lastMonth())
    const list = (await (await app.request("/vendor/business/statements", auth(sellerA))).json()) as any
    expect(list.months[0]).toMatchObject({ period: periodOf(new Date()), status: "open" })
    const csvRes = await app.request(`/vendor/business/statements/${periodOf(lastMonth())}/csv`, auth(sellerA))
    const text = await csvRes.text()
    expect(text).toContain("Fingerprint (SHA-256)")
    expect(text).toContain("Payouts paid")
    const future = new Date()
    future.setUTCMonth(future.getUTCMonth() + 2)
    expect((await app.request(`/vendor/business/statements/${periodOf(future)}`, auth(sellerA))).status).toBe(400)
    const platform = (await (await app.request(`/admin/business/statements/${periodOf(lastMonth())}`, auth(admin))).json()) as any
    expect(platform.statement.data.scope).toBe("platform")
  })

  it("sellers can't read the platform or another shop", async () => {
    const { app, sellerA } = await setup()
    expect((await app.request("/admin/business/overview", auth(sellerA))).status).toBe(403)
  })
})
