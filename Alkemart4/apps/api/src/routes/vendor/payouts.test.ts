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

function testEnv() {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET: JWT,
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

async function setup() {
  const snapshot = demoCatalog()
  const catalog = new InMemoryCatalogRepository(snapshot)
  const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
  const authRepo = new InMemoryAuthRepository()

  await authRepo.registerVendor({
    user: { id: "u-seller-a", email: "seller-a@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
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
  await authRepo.registerVendor({
    user: { id: "u-seller-b", email: "seller-b@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
    seller: { id: "seller-b", handle: "seller-b", name: "Kumasi Mart" },
  })
  await authRepo.createUser({
    id: "admin-1",
    email: "admin@alkemart.test",
    passwordHash: await hashPassword("AdminPass1"),
    role: "admin",
  })
  const adminToken = await signSessionJwt({ userId: "admin-1", role: "admin" }, JWT)

  const deliverOrder = async (qty: number) => {
    const cart = await checkoutRepo.createCart()
    await checkoutRepo.addCartItem(cart.id, "offer-a", qty)
    const quote = await checkoutRepo.quote(cart.id)
    const intentId = crypto.randomUUID()
    await checkoutRepo.createPaymentIntent({
      id: intentId,
      cartId: cart.id,
      method: "cod",
      status: "initiated",
      amountPesewas: quote.totalPesewas,
      currency: "GHS",
      paystackReference: null,
      buyerEmail: "buyer@t.test",
      momoProvider: null,
      momoPhone: null,
      shippingAddress: null,
    })
    const { orders } = await checkoutRepo.confirmPaidOrder(intentId)
    const orderId = orders[0]!.id
    await checkoutRepo.updateOrderStatus(orderId, "seller-a", "shipped")
    await checkoutRepo.updateOrderStatus(orderId, "seller-a", "delivered")
    return orderId
  }
  const order1 = await deliverOrder(1)
  const order2 = await deliverOrder(2)

  const login = await createApp({ repo: catalog, checkoutRepo, authRepo, jwtSecret: JWT }).request(
    "/vendor/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "seller-a@alkemart.test", password: "VendorPass1" }),
    },
    testEnv(),
  )
  const sellerToken = ((await login.json()) as { token: string }).token

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
  const auth = (token: string, method = "GET") => ({
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  })
  return { app, adminToken, sellerToken, order1, order2, auth }
}

describe("GET /vendor/payouts/statement (Phase 4D)", () => {
  it("lists delivered lines with domain-exact net math, then holds and pays", async () => {
    const { app, adminToken, sellerToken, order1, order2, auth } = await setup()

    const first = await app.request("/vendor/payouts/statement", auth(sellerToken), testEnv())
    expect(first.status).toBe(200)
    const open = (await first.json()) as {
      commissionBps: number
      totals: { pendingNetPesewas: string; pendingGrossPesewas: string; lineCount: number }
      lines: { orderId: string; state: string; netPesewas: string }[]
    }
    expect(open.commissionBps).toBe(700)
    expect(open.totals.lineCount).toBe(2)
    // 1500 @7% → 1395 ; 3000 @7% → 2790 ; pending 4185.
    expect(open.totals.pendingGrossPesewas).toBe("4500")
    expect(open.totals.pendingNetPesewas).toBe("4185")
    expect(open.lines.every((l) => l.state === "pending")).toBe(true)

    // Admin holds order1 with a reason; the statement freezes it honestly.
    const held = await app.request(
      "/admin/payouts/holds",
      {
        ...auth(adminToken, "POST"),
        body: JSON.stringify({ sellerId: "seller-a", orderId: order1, reason: "buyer dispute opened" }),
      },
      testEnv(),
    )
    expect(held.status).toBe(201)
    const holdId = ((await held.json()) as { hold: { id: string } }).hold.id

    const frozen = (await (
      await app.request("/vendor/payouts/statement", auth(sellerToken), testEnv())
    ).json()) as {
      totals: { pendingNetPesewas: string; heldNetPesewas: string }
      lines: { orderId: string; state: string; holdReason: string | null }[]
      holds: { id: string; reason: string }[]
    }
    expect(frozen.totals.pendingNetPesewas).toBe("2790")
    expect(frozen.totals.heldNetPesewas).toBe("1395")
    expect(frozen.lines.find((l) => l.orderId === order1)).toMatchObject({
      state: "held",
      holdReason: "buyer dispute opened",
    })
    expect(frozen.holds.map((h) => h.id)).toContain(holdId)

    // Release reverts to pending; payout settles both lines as paid.
    const released = await app.request(
      `/admin/payouts/holds/${holdId}/release`,
      auth(adminToken, "POST"),
      testEnv(),
    )
    expect(released.status).toBe(200)
    const paid = await app.request(
      "/admin/payouts",
      { ...auth(adminToken, "POST"), body: JSON.stringify({ sellerId: "seller-a" }) },
      testEnv(),
    )
    expect(paid.status).toBe(200)
    const settled = (await (
      await app.request("/vendor/payouts/statement", auth(sellerToken), testEnv())
    ).json()) as {
      totals: { pendingNetPesewas: string; paidNetPesewas: string }
      lines: { state: string; payoutId: string | null; payoutStatus: string | null }[]
    }
    expect(settled.totals.pendingNetPesewas).toBe("0")
    expect(settled.totals.paidNetPesewas).toBe("4185")
    expect(settled.lines.every((l) => l.state === "paid" && l.payoutStatus === "paid")).toBe(true)
    expect(order2).toBeTruthy()
  })

  it("rejects reason-less holds, foreign orders, and unknown sellers", async () => {
    const { app, adminToken, order1, auth } = await setup()
    const noReason = await app.request(
      "/admin/payouts/holds",
      { ...auth(adminToken, "POST"), body: JSON.stringify({ sellerId: "seller-a", orderId: order1, reason: "  " }) },
      testEnv(),
    )
    expect(noReason.status).toBe(400)
    const foreign = await app.request(
      "/admin/payouts/holds",
      { ...auth(adminToken, "POST"), body: JSON.stringify({ sellerId: "seller-b", orderId: order1, reason: "review" }) },
      testEnv(),
    )
    expect(foreign.status).toBe(400)
    const ghost = await app.request(
      "/admin/payouts/holds",
      { ...auth(adminToken, "POST"), body: JSON.stringify({ sellerId: "nope", reason: "review" }) },
      testEnv(),
    )
    expect(ghost.status).toBe(404)
    const missing = await app.request(
      "/admin/payouts/holds/nope/release",
      auth(adminToken, "POST"),
      testEnv(),
    )
    expect(missing.status).toBe(404)
  })

  it("applies a seller-level hold to the whole pending balance", async () => {
    const { app, adminToken, sellerToken, auth } = await setup()
    const held = await app.request(
      "/admin/payouts/holds",
      { ...auth(adminToken, "POST"), body: JSON.stringify({ sellerId: "seller-a", reason: "account review" }) },
      testEnv(),
    )
    expect(held.status).toBe(201)
    const frozen = (await (
      await app.request("/vendor/payouts/statement", auth(sellerToken), testEnv())
    ).json()) as {
      totals: { pendingNetPesewas: string; heldNetPesewas: string }
      lines: { state: string; holdReason: string | null }[]
    }
    expect(frozen.totals.pendingNetPesewas).toBe("0")
    expect(frozen.totals.heldNetPesewas).toBe("4185")
    expect(frozen.lines.every((l) => l.state === "held" && l.holdReason === "account review")).toBe(true)
  })
})
