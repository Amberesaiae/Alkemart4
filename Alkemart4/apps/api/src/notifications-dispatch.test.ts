import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "./auth-repository"
import { InMemoryCatalogRepository } from "./catalog-repository"
import { InMemoryCheckoutRepository } from "./checkout-repository"
import { demoCatalog } from "./demo-seed"
import { createApp } from "./index"
import { signSessionJwt } from "./lib/jwt"
import { dispatchPendingNotifications } from "./notifications-dispatch"
import { InMemorySmsProvider } from "./sms"
import { resetRateLimits } from "./middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"

const SHIPPING = {
  first_name: "Ama",
  last_name: "Mensah",
  phone: "0244123456",
  address_1: "12 High St",
  city: "Accra",
  country_code: "gh",
}

async function shipSetup() {
  const snapshot = demoCatalog()
  const catalog = new InMemoryCatalogRepository(snapshot)
  const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
  const authRepo = new InMemoryAuthRepository()
  await authRepo.registerVendor({
    user: { id: crypto.randomUUID(), email: "a@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
    seller: { id: "seller-a", handle: "seller-a-handle", name: "seller-a" },
  })
  await authRepo.updateSellerStatus("seller-a", "open")
  const user = (await authRepo.findUserByEmail("a@alkemart.test"))!
  const token = await signSessionJwt({ userId: user.id, role: "seller_member", sellerId: "seller-a" }, JWT)
  const app = createApp({ repo: catalog, checkoutRepo, authRepo, jwtSecret: JWT })

  const cart = await checkoutRepo.createCart()
  await checkoutRepo.addCartItem(cart.id, "offer-a", 1)
  const intentId = crypto.randomUUID()
  await checkoutRepo.createPaymentIntent({
    id: intentId,
    cartId: cart.id,
    method: "cod",
    status: "initiated",
    amountPesewas: (await checkoutRepo.quote(cart.id)).totalPesewas,
    currency: "ghs",
    paystackReference: null,
    buyerEmail: "buyer@t.test",
    momoProvider: null,
    momoPhone: null,
    shippingAddress: SHIPPING,
  })
  const { orders } = await checkoutRepo.confirmPaidOrder(intentId)
  return { app, checkoutRepo, token, orderId: orders[0]!.id }
}

describe("fulfillment SMS outbox", () => {
  it("ship flips status even when the SMS provider is down; retry sends once", async () => {
    const { app, checkoutRepo, token, orderId } = await shipSetup()
    const sms = new InMemorySmsProvider()
    sms.failNext = 99 // provider down

    const ship = await app.request(`/vendor/orders/${orderId}/ship`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(ship.status).toBe(200)

    // One row enqueued despite the (later) provider failure.
    const due = await checkoutRepo.claimPendingNotifications(10)
    expect(due).toHaveLength(1)
    expect(due[0]!.key).toBe(`${orderId}:shipped`)
    expect(due[0]!.recipient).toBe("+233244123456")
    // Return the claim so dispatch can pick it up again.
    await checkoutRepo.markNotificationFailed(due[0]!.id, "test reset")

    const failed = await dispatchPendingNotifications(checkoutRepo, sms)
    expect(failed.sent).toBe(0)
    expect(failed.failed).toBe(1)
    expect(sms.sent).toHaveLength(0)

    // Order still shipped — the write was never blocked.
    const order = await checkoutRepo.getOrder(orderId)
    expect(order?.status).toBe("shipped")

    sms.failNext = 0 // provider recovers
    const recovered = await dispatchPendingNotifications(checkoutRepo, sms)
    expect(recovered.sent).toBe(1)
    expect(sms.sent).toHaveLength(1)

    // Re-run sends nothing: no duplicates.
    const again = await dispatchPendingNotifications(checkoutRepo, sms)
    expect(again).toEqual({ claimed: 0, sent: 0, failed: 0 })
    expect(sms.sent).toHaveLength(1)
  })

  it("double-enqueue of the same key is a no-op", async () => {
    const { checkoutRepo } = await shipSetup()
    const first = await checkoutRepo.enqueueNotification({ key: "o1:shipped", recipient: "+233241234567", body: "hi" })
    const second = await checkoutRepo.enqueueNotification({ key: "o1:shipped", recipient: "+233241234567", body: "hi" })
    expect(first).toEqual({ inserted: true })
    expect(second).toEqual({ inserted: false })
    const sms = new InMemorySmsProvider()
    const result = await dispatchPendingNotifications(checkoutRepo, sms)
    expect(result.sent).toBe(1)
    expect(sms.sent).toHaveLength(1)
  })

  it("deliver enqueues its own key", async () => {
    const { app, checkoutRepo, token, orderId } = await shipSetup()
    await app.request(`/vendor/orders/${orderId}/ship`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    const deliver = await app.request(`/vendor/orders/${orderId}/deliver`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(deliver.status).toBe(200)
    const keys = (await checkoutRepo.claimPendingNotifications(10)).map((n) => n.key).sort()
    // Delivering also queues the one-shot verified-review request (Phase 7B).
    expect(keys).toEqual(
      [`${orderId}:delivered`, `${orderId}:review-request`, `${orderId}:shipped`].sort(),
    )
  })

  it("no phone → no message, no error", async () => {
    const snapshot = demoCatalog()
    const catalog = new InMemoryCatalogRepository(snapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const authRepo = new InMemoryAuthRepository()
    await authRepo.registerVendor({
      user: { id: crypto.randomUUID(), email: "b@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
      seller: { id: "seller-a", handle: "seller-a-handle", name: "seller-a" },
    })
    await authRepo.updateSellerStatus("seller-a", "open")
    const user = (await authRepo.findUserByEmail("b@alkemart.test"))!
    const token = await signSessionJwt({ userId: user.id, role: "seller_member", sellerId: "seller-a" }, JWT)
    const app = createApp({ repo: catalog, checkoutRepo, authRepo, jwtSecret: JWT })

    const cart = await checkoutRepo.createCart()
    await checkoutRepo.addCartItem(cart.id, "offer-a", 1)
    const intentId = crypto.randomUUID()
    await checkoutRepo.createPaymentIntent({
      id: intentId,
      cartId: cart.id,
      method: "cod",
      status: "initiated",
      amountPesewas: (await checkoutRepo.quote(cart.id)).totalPesewas,
      currency: "ghs",
      paystackReference: null,
      buyerEmail: "buyer@t.test",
      momoProvider: null,
      momoPhone: null,
      shippingAddress: null,
    })
    const { orders } = await checkoutRepo.confirmPaidOrder(intentId)
    const ship = await app.request(`/vendor/orders/${orders[0]!.id}/ship`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(ship.status).toBe(200)
    expect(await checkoutRepo.claimPendingNotifications(10)).toHaveLength(0)
  })
})
