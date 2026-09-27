/**
 * Local SANDBOX API — in-memory data only, never touches Supabase.
 *
 *   bun apps/api/scripts/sandbox.ts            # http://127.0.0.1:8788
 *
 * For walking real buyer → seller → admin cycles (checkout, pack/send/
 * deliver, moderation, payout statement) without writing to the shared
 * database. State resets on restart. Prints ready-made session tokens for a
 * test seller and a test admin so the consoles can be opened without typing
 * credentials; paste one into the app's localStorage (see output).
 *
 * Point a UI at it with `VITE_ALKEMART_API_URL=http://127.0.0.1:8788`
 * (each app has `.env.sandbox`; run `vite --mode sandbox`).
 */
import { hashPassword } from "@alkemart/domain"
import { InMemoryAuthRepository } from "../src/auth-repository"
import { InMemoryCatalogRepository } from "../src/catalog-repository"
import { InMemoryCheckoutRepository } from "../src/checkout-repository"
import { demoCatalog } from "../src/demo-seed"
import { createApp } from "../src/index"
import { deliveryPromiseFromMetadata } from "../src/lib/delivery-promise"
import { signSessionJwt } from "../src/lib/jwt"

const PORT = Number(process.env.SANDBOX_PORT ?? 8788)
// Fixed, sandbox-only secret + ids so signed-in consoles survive restarts.
// Tokens minted here are useless against any real API (different secret).
const JWT = "alkemart-local-sandbox-only-secret-not-for-any-real-api"
const ORIGINS = [3013, 3014, 5186].flatMap((p) => [`http://localhost:${p}`, `http://127.0.0.1:${p}`]).join(",")

const snapshot = demoCatalog()
// Realistic Ghana prices for walking the screens (unit tests keep their own
// small fixed numbers): a mid-range Tecno phone and typical delivery fees.
const PRICES: Record<string, bigint> = { "offer-a": 185_000n, "offer-b": 192_000n }
for (const o of snapshot.offers) if (PRICES[o.id]) o.pricePesewas = PRICES[o.id]!
const FEES: Record<string, bigint> = { "seller-a": 3_000n, "seller-b": 4_500n }
for (const sl of snapshot.sellers) if (FEES[sl.id] != null) (sl as { deliveryFeePesewas?: bigint }).deliveryFeePesewas = FEES[sl.id]!
// The two-seller phone is a reviewed, identified product, so the storefront's
// seller comparison can be walked (unreviewed listings don't compare).
const spark = snapshot.products.find((p) => p.id === "prod-tecno-spark")
if (spark) Object.assign(spark, { identityConfidence: "identified", brand: "Tecno", model: "Spark" })
// A second phone from another shop, so ⚖ Compare mode has two things to put side by side.
if (spark) {
  snapshot.products.push({ ...spark, id: "prod-itel-a70", title: "itel A70", description: "Big battery budget phone", sellerId: "seller-b", brand: "itel", model: "A70" } as typeof spark)
  const v = snapshot.variants.find((x) => x.productId === spark.id)!
  snapshot.variants.push({ ...v, id: "var-itel-a70", productId: "prod-itel-a70", sku: "ITEL-A70" })
  const o = snapshot.offers.find((x) => x.id === "offer-b")!
  snapshot.offers.push({ ...o, id: "offer-itel", productId: "prod-itel-a70", variantId: "var-itel-a70", pricePesewas: 139_000n, onHand: 6 })
}
const repo = new InMemoryCatalogRepository(snapshot)
const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
const authRepo = new InMemoryAuthRepository()

// Random throwaway password: nobody signs in with it; tokens are minted below.
const throwaway = await hashPassword(crypto.randomUUID())

const sellerUserId = "sandbox-seller-user"
await authRepo.registerVendor({
  user: { id: sellerUserId, email: "seller-a@sandbox.test", passwordHash: throwaway },
  seller: { id: "seller-a", handle: "seller-a", name: "Accra Mart" },
})
await authRepo.updateSellerStatus("seller-a", "open")
// Seller A promises 1–3 days, dispatch within 24h. It lives on the seller
// record (as in Postgres) so edits in vendor → Shop change the next order.
await authRepo.patchSellerMetadata("seller-a", { delivery: { days: { min: 1, max: 3 }, dispatchHours: 24 } })
checkoutRepo.promiseFor = async (id) => deliveryPromiseFromMetadata((await authRepo.findSellerById(id))?.metadata)

const buyerUserId = "sandbox-buyer-user"
await authRepo.createUser({ id: buyerUserId, email: "buyer@sandbox.test", passwordHash: throwaway, role: "buyer" })

const adminUserId = "sandbox-admin-user"
await authRepo.createUser({ id: adminUserId, email: "ops@sandbox.test", passwordHash: throwaway, role: "admin" })

// Fake Paystack (sandbox only — never a real key): transfers answer "pending"
// like live Paystack, and "Check status" answers "success", so the whole
// payout cycle can be walked in the consoles. The MoMo account below makes
// seller-a payable.
// (In real-Paystack test mode the payout account is created through the
// vendor API instead, so Paystack issues a real test recipient.)
if (process.env.SANDBOX_REAL_PAYSTACK !== "1") {
  await authRepo.updateSellerGhanaSetup("seller-a", {
    name: "Accra Mart",
    packRegion: "greater_accra",
    digitalAddress: null,
    deliveryFeePesewas: 3_000n,
    momoProvider: "mtn",
    momoPhone: "0244123456",
    recipientCode: "RCP_sandbox",
  })
}
// Two delivered MoMo orders so seller-a has something to be paid for.
for (let i = 0; i < 2; i++) {
  const cart = await checkoutRepo.createCart()
  await checkoutRepo.addCartItem(cart.id, "offer-a", 1)
  const quote = await checkoutRepo.quote(cart.id)
  const intentId = crypto.randomUUID()
  await checkoutRepo.createPaymentIntent({
    id: intentId, cartId: cart.id, method: "momo", status: "initiated", amountPesewas: quote.totalPesewas, currency: "GHS",
    paystackReference: null, buyerEmail: "buyer@sandbox.test", momoProvider: null, momoPhone: null, shippingAddress: null,
  })
  const { orders } = await checkoutRepo.confirmPaidOrder(intentId)
  for (const o of orders) {
    await checkoutRepo.updateOrderStatus(o.id, o.sellerId, "shipped")
    await checkoutRepo.updateOrderStatus(o.id, o.sellerId, "delivered")
  }
}

// ~14 months of varied history so Business overviews, year views and frozen
// statements can be walked. Sandbox only: the in-memory clock is moved back
// for each order, then restored. Shops "joined" 15 months ago.
{
  const DAY = 86_400_000
  const joined = new Date(Date.now() - 460 * DAY)
  const sellersMap = (authRepo as unknown as { sellersById: Map<string, { createdAt: Date }> }).sellersById
  await authRepo.registerVendor({
    user: { id: "sandbox-seller-b-user", email: "seller-b@sandbox.test", passwordHash: throwaway },
    seller: { id: "seller-b", handle: "seller-b", name: "Kumasi Tech" },
  })
  await authRepo.updateSellerStatus("seller-b", "open")
  for (const id of ["seller-a", "seller-b"]) {
    const sl = sellersMap.get(id)
    if (sl) sl.createdAt = joined
  }
  const offers = snapshot.offers.filter((o) => o.active && (o.sellerId === "seller-a" || o.sellerId === "seller-b"))
  const stock = new Map(offers.map((o) => [o.id, o.onHand]))
  for (const o of offers) o.onHand = 10_000
  const buyers = ["ama@sandbox.test", "kofi@sandbox.test", "esi@sandbox.test", "yaw@sandbox.test", "akosua@sandbox.test", "kwame@sandbox.test"]
  const places = [
    { city: "Accra", province: "Greater Accra" },
    { city: "Tema", province: "Greater Accra" },
    { city: "Kumasi", province: "Ashanti" },
    { city: "Takoradi", province: "Western" },
    { city: "Cape Coast", province: "Central" },
  ]
  // Deterministic pseudo-random so every restart shows the same history.
  let seed = 42
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  for (let daysAgo = 430; daysAgo >= 1; daysAgo -= 1 + Math.floor(rnd() * 5)) {
    const offer = offers[Math.floor(rnd() * offers.length)]!
    const place = places[Math.floor(rnd() * places.length)]!
    const at = new Date(Date.now() - daysAgo * DAY + Math.floor(rnd() * 10) * 3_600_000)
    checkoutRepo.now = () => at
    const cart = await checkoutRepo.createCart()
    await checkoutRepo.addCartItem(cart.id, offer.id, 1 + Math.floor(rnd() * 2))
    const quote = await checkoutRepo.quote(cart.id)
    const cod = rnd() < 0.55
    const intentId = crypto.randomUUID()
    await checkoutRepo.createPaymentIntent({
      id: intentId, cartId: cart.id, method: cod ? "cod" : "momo", status: "initiated", amountPesewas: quote.totalPesewas, currency: "GHS",
      paystackReference: cod ? null : `hist_${intentId.slice(0, 8)}`, buyerEmail: buyers[Math.floor(rnd() * buyers.length)]!,
      momoProvider: null, momoPhone: null,
      shippingAddress: { first_name: "Sandbox", last_name: "Buyer", phone: "0244000000", address_1: "Sandbox street", country_code: "gh", ...place },
    })
    const { orders } = await checkoutRepo.confirmPaidOrder(intentId)
    for (const o of orders) {
      if (rnd() < 0.06) {
        await checkoutRepo.updateOrderStatus(o.id, o.sellerId, "cancelled")
        continue
      }
      checkoutRepo.now = () => new Date(at.getTime() + DAY)
      await checkoutRepo.updateOrderStatus(o.id, o.sellerId, "shipped")
      checkoutRepo.now = () => new Date(at.getTime() + 2 * DAY)
      await checkoutRepo.updateOrderStatus(o.id, o.sellerId, "delivered")
    }
    // Pay seller-a out at the start of each month for what's delivered online.
    const next = new Date(Date.now() - (daysAgo - 3) * DAY)
    if (next.getUTCDate() <= 5 && rnd() < 0.8) {
      checkoutRepo.now = () => next
      try {
        const p = await checkoutRepo.reservePayout({ sellerId: "seller-a", commissionBps: 0, reference: `payout_hist_${daysAgo}`, createdBy: "sandbox" })
        await checkoutRepo.markPayoutSent(p.id, "TRF_hist", "sandbox")
        await checkoutRepo.settlePayout(p.id, "paid", { actor: "sandbox" })
      } catch {
        /* nothing payable that month */
      }
    }
  }
  checkoutRepo.now = () => new Date()
  for (const o of offers) {
    o.onHand = stock.get(o.id) ?? o.onHand
    o.reserved = 0
  }
}

// SANDBOX_REAL_PAYSTACK=1 → talk to Paystack's real TEST API with the key in
// apps/api/.dev.vars (never printed; anything but sk_test_ is refused, so no
// real money can move). Otherwise a local fake Paystack is used.
const realPaystack = process.env.SANDBOX_REAL_PAYSTACK === "1"
const testKey = realPaystack
  ? await (async () => {
      const vars = await Bun.file(new URL("../.dev.vars", import.meta.url)).text().catch(() => "")
      const k = vars.match(/^\s*PAYSTACK_SECRET_KEY\s*=\s*"?([^"\s]+)"?/m)?.[1] ?? ""
      if (!k.startsWith("sk_test_")) throw new Error("SANDBOX_REAL_PAYSTACK needs an sk_test_ key in apps/api/.dev.vars — refusing to run with anything else")
      return k
    })()
  : null
console.log(JSON.stringify({ sandbox: "paystack", mode: realPaystack ? "real TEST API" : "local fake" }))
const app = createApp(
  realPaystack
    ? { repo, checkoutRepo, authRepo, jwtSecret: JWT, paystackSecretKey: testKey! }
    : {
        repo,
        checkoutRepo,
        authRepo,
        jwtSecret: JWT,
        paystackSecretKey: "sk_sandbox_fake_not_a_real_key",
        createPaystackTransferRecipient: async () => ({ recipientCode: "RCP_sandbox" }),
        createPaystackTransfer: async (_cfg, input) => ({ transferCode: "TRF_sandbox", reference: input.reference, status: "pending" }),
        verifyPaystackTransfer: async () => ({ status: "success", amount: null, transferCode: "TRF_sandbox", reason: null }),
        // Refunds answer "pending" like live Paystack; the refund.processed
        // webhook isn't simulated, so they stay "on its way" in the sandbox.
        // MoMo checkout: the "charge" asks the buyer to approve on their phone;
        // the status poll then verifies it as paid for the intent's exact amount.
        // Card checkout: skip Paystack's hosted page and come straight back to
        // the storefront's callback, as if the buyer paid.
        initializePaystackTransaction: async (_cfg, input) => {
          const back = new URL(input.callbackUrl)
          back.searchParams.set("reference", input.reference)
          back.searchParams.set("trxref", input.reference)
          return { authorizationUrl: back.toString(), reference: input.reference, accessCode: "sandbox" }
        },
        chargePaystackMobileMoney: async (_cfg, input) => ({ status: "pay_offline", reference: input.reference, data: {} }),
        verifyPaystackTransaction: async (_cfg, reference) => {
          const intent = await checkoutRepo.getPaymentIntentByReference(reference)
          return { status: "success", amount: Number(intent?.amountPesewas ?? 0), reference, currency: intent?.currency ?? "GHS", raw: {} }
        },
        refundPaystackTransaction: async () => ({ status: "pending", refundId: `RFD_sandbox_${crypto.randomUUID().slice(0, 8)}` }),
      },
)

/** In-memory stand-in for the R2 media bucket (put/get only) so photo uploads work. */
const media = new Map<string, { bytes: Uint8Array; contentType: string }>()
const MEDIA_BUCKET = {
  async put(key: string, value: Uint8Array | ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
    media.set(key, { bytes, contentType: opts?.httpMetadata?.contentType ?? "application/octet-stream" })
    return { key }
  },
  async get(key: string) {
    const hit = media.get(key)
    return hit ? { body: hit.bytes, httpMetadata: { contentType: hit.contentType }, etag: key } : null
  },
}

// Sandbox-only time travel, to walk deadlines (report windows, return
// replies) without waiting: POST /__sandbox/clock {"hours": 49}. Moves the
// in-memory clock forward; restarting the sandbox resets it.
let clockOffsetMs = 0
checkoutRepo.now = () => new Date(Date.now() + clockOffsetMs)

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  fetch: async (req) => {
    const url = new URL(req.url)
    if (url.pathname === "/__sandbox/clock") {
      const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Content-Type": "application/json" }
      if (req.method === "OPTIONS") return new Response(null, { headers: cors })
      if (req.method === "POST") {
        const body = (await req.json().catch(() => ({}))) as { hours?: number }
        if (typeof body.hours === "number" && Number.isFinite(body.hours)) clockOffsetMs += body.hours * 3_600_000
      }
      return new Response(JSON.stringify({ now: checkoutRepo.now().toISOString(), offsetHours: clockOffsetMs / 3_600_000 }), { headers: cors })
    }
    return app.fetch(req, {
      ALLOWED_ORIGINS: ORIGINS,
      MEDIA_BUCKET,
      ENVIRONMENT: "development",
      // Email links point at the sandbox apps (the log stub prints them).
      STOREFRONT_URL: "http://localhost:5186",
      VENDOR_URL: "http://localhost:3014",
    })
  },
})

const sellerToken = await signSessionJwt({ userId: sellerUserId, role: "seller_member", sellerId: "seller-a" }, JWT)
const adminToken = await signSessionJwt({ userId: adminUserId, role: "admin" }, JWT)
const buyerToken = await signSessionJwt({ userId: buyerUserId, role: "buyer" }, JWT)
const session = (token: string, user: object) => JSON.stringify({ token, user })

console.log(`sandbox API on http://127.0.0.1:${PORT} (in-memory; restarts wipe state)`)
console.log(`SELLER_SESSION=${session(sellerToken, { id: sellerUserId, email: "seller-a@sandbox.test", role: "seller_member", sellerId: "seller-a" })}`)
console.log(`BUYER_SESSION=${session(buyerToken, { id: buyerUserId, email: "buyer@sandbox.test", role: "buyer" })}`)
console.log(`ADMIN_SESSION=${session(adminToken, { id: adminUserId, email: "ops@sandbox.test", role: "admin" })}`)
