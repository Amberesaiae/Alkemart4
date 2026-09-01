import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { signSessionJwt } from "../../lib/jwt"

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"

describe("admin Paystack payouts", () => {
  it("pays delivered orders net of commission; 503 without key", async () => {
    const snapshot = demoCatalog()
    const catalog = new InMemoryCatalogRepository(snapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const authRepo = new InMemoryAuthRepository()

    await authRepo.registerVendor({
      user: {
        id: "u-seller-a",
        email: "seller-a@alkemart.test",
        passwordHash: await hashPassword("VendorPass1"),
      },
      seller: { id: "seller-a", handle: "seller-a-payout", name: "Accra Mart" },
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

    await authRepo.createUser({
      id: "admin-1",
      email: "admin@alkemart.test",
      passwordHash: await hashPassword("AdminPass1"),
      role: "admin",
    })
    const adminToken = await signSessionJwt(
      { userId: "admin-1", role: "admin" },
      JWT,
    )

    const cart = await checkoutRepo.createCart()
    await checkoutRepo.addCartItem(cart.id, "offer-a", 1)
    const quote = await checkoutRepo.quote(cart.id)
    const intentId = crypto.randomUUID()
    await checkoutRepo.createPaymentIntent({
      id: intentId,
      cartId: cart.id,
      method: "cod",
      status: "initiated",
      amountPesewas: quote.totalPesewas,
      currency: "ghs",
      paystackReference: null,
      buyerEmail: "buyer@t.test",
      momoProvider: null,
      momoPhone: null,
    })
    const { orders } = await checkoutRepo.confirmPaidOrder(intentId)
    const orderId = orders[0]!.id
    await checkoutRepo.updateOrderStatus(orderId, "seller-a", "shipped")
    await checkoutRepo.updateOrderStatus(orderId, "seller-a", "delivered")

    const noKey = createApp({
      repo: catalog,
      checkoutRepo,
      authRepo,
      jwtSecret: JWT,
    })
    const denied = await noKey.request("/admin/payouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sellerId: "seller-a" }),
    })
    expect(denied.status).toBe(503)

    const app = createApp({
      repo: catalog,
      checkoutRepo,
      authRepo,
      jwtSecret: JWT,
      paystackSecretKey: "sk_test",
      createPaystackTransfer: async (_cfg, input) => ({
        transferCode: "TRF_test",
        reference: input.reference,
        status: "success",
      }),
    })
    const paid = await app.request("/admin/payouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sellerId: "seller-a" }),
    })
    expect(paid.status).toBe(200)
    const body = (await paid.json()) as {
      payout: { netPesewas: string; commissionBps: number; status: string }
    }
    expect(body.payout.status).toBe("paid")
    expect(body.payout.commissionBps).toBe(700)
    // subtotal 1500 @ 7% = 105 commission → net 1395
    expect(body.payout.netPesewas).toBe("1395")
  })
})
