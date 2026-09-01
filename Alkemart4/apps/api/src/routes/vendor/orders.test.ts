import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { signSessionJwt } from "../../lib/jwt"

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
      currency: "ghs",
      paystackReference: null,
      buyerEmail: "buyer@t.test",
      momoProvider: null,
      momoPhone: null,
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

    const deliver = await app.request(`/vendor/orders/${orderId}/deliver`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    expect(deliver.status).toBe(200)
    const body = (await deliver.json()) as { order: { status: string } }
    expect(body.order.status).toBe("delivered")
  })
})
