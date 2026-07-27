/**
 * Seed E2E test accounts into the marketplace.
 *
 * Creates:
 *   1 admin account (if not exists)
 *   2 seller accounts with approved products (if not exist)
 *   1 buyer account (if not exists)
 *
 * Run: bun run e2e/scripts/seed-e2e-accounts.ts
 * Requires API_URL env (default: http://localhost:9000)
 */

const API = (process.env.API_URL ?? "http://localhost:9000").replace(/\/$/, "")

async function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}

async function get(path: string, token?: string) {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { headers })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json }
}

async function ensureAdmin() {
  const email = process.env.E2E_ADMIN_EMAIL ?? "admin@alkemart.local"
  const password = process.env.E2E_ADMIN_PASSWORD ?? "supersecret"

  // Register
  const reg = await post("/auth/user/emailpass/register", { email, password })
  if (reg.status >= 400 && reg.status < 500) {
    console.log(`[seed] admin registration skipped (${reg.status}): likely exists`)
  } else if (reg.status >= 200 && reg.status < 300) {
    console.log("[seed] admin account created")
  }

  // Ensure admin role via invite flow if needed
  const login = await post("/auth/user/emailpass", { email, password })
  if (login.json?.token) {
    console.log("[seed] admin login OK")
    return { token: login.json.token as string, email, password }
  }
  throw new Error(`Cannot login as admin: ${login.text.slice(0, 200)}`)
}

async function ensureSeller(email: string, password: string, storeName: string, adminToken: string) {
  // Register as member
  const reg = await post("/auth/member/emailpass/register", { email, password })
  if (reg.status >= 400 && reg.status < 500) {
    console.log(`[seed] seller ${email} registration skipped: likely exists`)
  }

  const login = await post("/auth/member/emailpass", { email, password })
  if (!login.json?.token) {
    console.error(`[seed] seller ${email} login failed: ${login.text.slice(0, 200)}`)
    return null
  }
  const token = login.json.token as string
  console.log(`[seed] seller ${email} login OK`)

  // Get seller membership
  const meRes = await get("/vendor/sellers", token)
  const members = meRes.json?.seller_members ?? []
  const existingSellers = members.map((m: any) => m.seller ?? { id: m.seller_id }).filter(Boolean)

  if (existingSellers.length > 0) {
    console.log(`[seed] seller ${email} already has ${existingSellers.length} store(s)`)
    return { token, email, password, sellerId: existingSellers[0].id }
  }

  // Create a seller record via admin
  if (adminToken) {
    // Try creating seller via admin endpoint
    const createRes = await post("/admin/sellers", {
      name: storeName,
      members: [{ email }],
      default_currency_code: "ghs",
      default_sales_channel_name: "Default Channel",
      countries: ["gh"],
    }, adminToken)

    if (createRes.status >= 200 && createRes.status < 300) {
      const sellerId = createRes.json?.seller?.id ?? createRes.json?.id
      if (sellerId) {
        console.log(`[seed] store "${storeName}" created for ${email} (${sellerId})`)
        return { token, email, password, sellerId }
      }
    } else {
      console.error(`[seed] store creation failed: ${createRes.text.slice(0, 200)}`)
    }
  }

  return { token, email, password, sellerId: null }
}

async function ensureBuyer() {
  const email = "e2e-buyer@alkemart.test"
  const password = "test-buyer-2026!"

  const reg = await post("/auth/customer/emailpass/register", { email, password })
  if (reg.status >= 400 && reg.status < 500) {
    console.log("[seed] buyer registration skipped: likely exists")
  }

  const login = await post("/auth/customer/emailpass", { email, password })
  if (login.json?.token) {
    console.log("[seed] buyer login OK")
    // Ensure customer record exists
    await post("/store/customers", {
      email,
      first_name: "E2E",
      last_name: "Buyer",
    }, login.json.token)
    return { token: login.json.token as string, email, password }
  }
  console.error(`[seed] buyer login failed: ${login.text.slice(0, 200)}`)
  return null
}

async function main() {
  console.log("[seed] starting E2E account seeding...")

  const admin = await ensureAdmin()
  const seller1 = await ensureSeller(
    process.env.E2E_SELLER_EMAIL ?? "amberstone@gmail.com",
    process.env.E2E_SELLER_PASSWORD ?? "alkemart25vent",
    "Amberstone Market",
    admin.token,
  )
  const seller2 = await ensureSeller(
    process.env.E2E_SELLER2_EMAIL ?? "goldtrade@alkemart.test",
    process.env.E2E_SELLER2_PASSWORD ?? "alkemart25vent",
    "Gold Trade Ghana",
    admin.token,
  )
  const buyer = await ensureBuyer()

  console.log("\n[seed] === Summary ===")
  console.log(`  Admin:     ${admin.email}`)
  console.log(`  Seller 1:  ${seller1?.email} (${seller1?.sellerId ?? "no store"})`)
  console.log(`  Seller 2:  ${seller2?.email} (${seller2?.sellerId ?? "no store"})`)
  console.log(`  Buyer:     ${buyer?.email ?? "failed"}`)

  if (seller1?.sellerId) {
    console.log(`\n[seed] Seller 1 is ready for E2E (store: ${seller1.sellerId})`)
  }
}

main().catch((err) => {
  console.error("[seed] fatal:", err)
  process.exit(1)
})
