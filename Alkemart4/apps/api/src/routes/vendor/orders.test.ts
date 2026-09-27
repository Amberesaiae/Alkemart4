import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { signSessionJwt } from "../../lib/jwt"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"

async function seedSellerAuth(authRepo: InMemoryAuthRepository, sellerId: string, email: string) {
  await authRepo.registerVendor({
    user: {
      id: crypto.randomUUID(),
      email,
      passwordHash: await hashPassword("VendorPass1"),
    },
    seller: { id: sellerId, handle: `${sellerId}-handle`, name: sellerId },
  })
  await authRepo.updateSellerStatus(sellerId, "open")
  const user = await authRepo.findUserByEmail(email)
  return user!
}

describe("vendor order fulfillment", () => {
  it("ships/delivers own order; other seller gets 404", async () => {
    const snapshot = demoCatalog()
    const catalog = new InMemoryCatalogRepository(snapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const authRepo = new InMemoryAuthRepository()
    const userA = await seedSellerAuth(authRepo, "seller-a", "a@alkemart.test")
    const userB = await seedSellerAuth(authRepo, "seller-b", "b@alkemart.test")

    const tokenA = await signSessionJwt(
      { userId: userA.id, role: "seller_member", sellerId: "seller-a" },
      JWT,
    )
    const tokenB = await signSessionJwt(
      { userId: userB.id, role: "seller_member", sellerId: "seller-b" },
      JWT,
    )

    const app = createApp({
      repo: catalog,
      checkoutRepo,
      authRepo,
      jwtSecret: JWT,
    })

    const cart = await checkoutRepo.createCart()
    await checkoutRepo.addCartItem(cart.id, "offer-a", 1)
    const intentId = crypto.randomUUID()
    await checkoutRepo.createPaymentIntent({
      id: intentId,
      cartId: cart.id,
      method: "cod",
      status: "initiated",
      amountPesewas: (await checkoutRepo.quote(cart.id)).totalPesewas,
      currency: "GHS",
      paystackReference: null,
      buyerEmail: "buyer@t.test",
      momoProvider: null,
      momoPhone: null,
      shippingAddress: null,
    })
    const { orders } = await checkoutRepo.confirmPaidOrder(intentId)
    const orderId = orders[0]!.id

    const ship = await app.request(`/vendor/orders/${orderId}/ship`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    expect(ship.status).toBe(200)

    const cross = await app.request(`/vendor/orders/${orderId}/deliver`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}` },
    })
    expect(cross.status).toBe(404)

    const deliverWith = (code: string) =>
      app.request(`/vendor/orders/${orderId}/deliver`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
    const code = (await checkoutRepo.getOrder(orderId))!.handoverCode!
    expect(code).toMatch(/^\d{4}$/)

    // A wrong code is refused (tries counted); the seller can still skip the code.
    const wrong = await deliverWith(code === "0000" ? "1111" : "0000")
    expect(wrong.status).toBe(422)
    expect(await wrong.text()).toContain("4 tries left")

    // The seller's order view says a code can be used but never shows it.
    const view = await app.request(`/vendor/orders/${orderId}`, { headers: { Authorization: `Bearer ${tokenA}` } })
    const viewText = await view.text()
    expect(viewText).toContain('"handoverAvailable":true')
    expect(viewText).not.toContain(`"handoverCode"`)

    const deliver = await deliverWith(code.slice(0, 2) + " " + code.slice(2))
    expect(deliver.status).toBe(200)
    const body = (await deliver.json()) as { order: { status: string } }
    expect(body.order.status).toBe("delivered")
    expect((await checkoutRepo.getOrder(orderId))!.deliveryConfirmedBy).toBe("buyer_code")
  })

  it("list carries date, items, area and payment method — never street or phone", async () => {
    const snapshot = demoCatalog()
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const authRepo = new InMemoryAuthRepository()
    const userA = await seedSellerAuth(authRepo, "seller-a", "a@alkemart.test")
    const tokenA = await signSessionJwt({ userId: userA.id, role: "seller_member", sellerId: "seller-a" }, JWT)
    const app = createApp({ repo: new InMemoryCatalogRepository(snapshot), checkoutRepo, authRepo, jwtSecret: JWT })

    const cart = await checkoutRepo.createCart()
    await checkoutRepo.addCartItem(cart.id, "offer-a", 2)
    const intentId = crypto.randomUUID()
    await checkoutRepo.createPaymentIntent({
      id: intentId,
      cartId: cart.id,
      method: "cod",
      status: "initiated",
      amountPesewas: (await checkoutRepo.quote(cart.id)).totalPesewas,
      currency: "GHS",
      paystackReference: null,
      buyerEmail: "buyer@t.test",
      momoProvider: null,
      momoPhone: null,
      shippingAddress: {
        first_name: "Ama",
        last_name: "Mensah",
        phone: "0241234567",
        address_1: "12 Ring Road",
        city: "Osu",
        province: "Greater Accra",
        country_code: "gh",
      },
    })
    await checkoutRepo.confirmPaidOrder(intentId)

    const res = await app.request("/vendor/orders", { headers: { Authorization: `Bearer ${tokenA}` } })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      items: Array<Record<string, unknown> & { items: { qty: number }[]; shipTo: unknown }>
    }
    const o = body.items[0]!
    expect(o.status).toBe("placed")
    expect(typeof o.placedAt).toBe("string")
    expect(o.itemCount).toBe(2)
    expect(o.items[0]!.qty).toBe(2)
    expect(o.shipTo).toEqual({ city: "Osu", region: "Greater Accra" })
    expect(o.paymentMethod).toBe("cod")
    const raw = JSON.stringify(body)
    expect(raw).not.toContain("Ring Road")
    expect(raw).not.toContain("0241234567")
  })

  it("freezes the seller's delivery promise and records a dated timeline", async () => {
    const snapshot = demoCatalog()
    const sellerA = snapshot.sellers.find((s) => s.id === "seller-a")!
    sellerA.delivery = { days: { min: 1, max: 3 }, dispatchHours: 12 }
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const authRepo = new InMemoryAuthRepository()
    const userA = await seedSellerAuth(authRepo, "seller-a", "a@alkemart.test")
    const tokenA = await signSessionJwt({ userId: userA.id, role: "seller_member", sellerId: "seller-a" }, JWT)
    const app = createApp({ repo: new InMemoryCatalogRepository(snapshot), checkoutRepo, authRepo, jwtSecret: JWT })
    const cart = await checkoutRepo.createCart()
    await checkoutRepo.addCartItem(cart.id, "offer-a", 1)
    const intentId = crypto.randomUUID()
    await checkoutRepo.createPaymentIntent({
      id: intentId, cartId: cart.id, method: "cod", status: "initiated",
      amountPesewas: (await checkoutRepo.quote(cart.id)).totalPesewas, currency: "GHS",
      paystackReference: null, buyerEmail: "buyer@t.test", momoProvider: null, momoPhone: null, shippingAddress: null,
    })
    const { orders, orderGroup } = await checkoutRepo.confirmPaidOrder(intentId)
    const order = orders[0]!
    const placed = (orderGroup as unknown as { createdAt: Date }).createdAt.getTime()
    expect(order.dispatchBy!.getTime() - placed).toBe(12 * 3_600_000)
    expect(order.deliverLatest!.getTime() - placed).toBe(3 * 86_400_000)

    const auth = { headers: { Authorization: `Bearer ${tokenA}` } }
    await app.request(`/vendor/orders/${order.id}/ship`, { method: "POST", ...auth })
    const res = await app.request(`/vendor/orders/${order.id}`, auth)
    const body = (await res.json()) as {
      order: { timeline: { status: string; at: string; by: string }[]; promise: { state: string; deliverLatest: string }; paymentState: string }
    }
    expect(body.order.timeline.map((t) => t.status)).toEqual(["placed", "shipped"])
    expect(body.order.timeline[1]!.by).toBe("seller")
    expect(body.order.promise.state).toBe("on_track")
    expect(body.order.paymentState).toBe("collect_on_delivery")

    // A repeated tap is a harmless no-op: no second event.
    const again = await app.request(`/vendor/orders/${order.id}/ship`, { method: "POST", ...auth })
    expect(again.status).toBe(200)
    const after = (await (await app.request(`/vendor/orders/${order.id}`, auth)).json()) as { order: { timeline: unknown[] } }
    expect(after.order.timeline).toHaveLength(2)
  })
})
