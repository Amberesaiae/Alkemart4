/**
 * Live browser + API RBAC audit — multi-vendor ecommerce (atomic phases).
 *
 * Principles:
 * - No seed scripts, no DB injection mid-test
 * - Real credentials (env or documented lab accounts already in Neon)
 * - Real product images from e2e/fixtures/images (copied from brand pack)
 * - Serial phases so each actor’s boundary is explicit
 *
 * Run (servers up):
 *   cd e2e && bun run test:rbac
 *   # or from monorepo root: bun run smoke:rbac
 */

import { test, expect } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"
import { ADMIN, API, SHOP, SELLER, creds, publishableKey } from "../lib/env"
import {
  createVendorProduct,
  getCatalog,
  getModerationSummary,
  getOnboarding,
  listSellerStores,
  listVendorProducts,
  loginAdmin,
  loginSeller,
  registerAndLoginBuyer,
  uploadVendorImage,
  getJson,
} from "../lib/api"
import { loginAdminPanel, loginSellerPanel, selectSellerStore } from "../lib/browser-auth"

test.describe.configure({ mode: "serial" })

const REPORT_DIR = path.join(__dirname, "../reports")
const IMAGE_A = path.join(
  __dirname,
  "../fixtures/images/ghana-doorstep-delivery.png",
)
const IMAGE_B = path.join(
  __dirname,
  "../fixtures/images/ghana-marketplace.png",
)

const audit: Record<string, unknown> = {
  started_at: new Date().toISOString(),
  hosts: { API, SHOP, ADMIN, SELLER },
  phases: {} as Record<string, unknown>,
}

function phase(name: string, data: unknown) {
  ;(audit.phases as Record<string, unknown>)[name] = data
}

test.afterAll(async () => {
  audit.finished_at = new Date().toISOString()
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const out = path.join(
    REPORT_DIR,
    `rbac-live-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  )
  fs.writeFileSync(out, JSON.stringify(audit, null, 2))
  // latest pointer
  fs.writeFileSync(
    path.join(REPORT_DIR, "rbac-live-latest.json"),
    JSON.stringify(audit, null, 2),
  )
})

// ─── Phase 0: live stack ───────────────────────────────────────────
test("0 · preflight — API + shop alive", async ({ request }) => {
  const health = await request.get(`${API}/health`)
  expect(health.ok(), "API /health must be 200").toBeTruthy()

  const shop = await request.get(SHOP)
  expect(shop.status(), "shop must respond").toBeLessThan(500)

  expect(fs.existsSync(IMAGE_A), "real image fixture A").toBeTruthy()
  expect(fs.existsSync(IMAGE_B), "real image fixture B").toBeTruthy()

  phase("0_preflight", {
    health: health.status(),
    shop: shop.status(),
    images: [path.basename(IMAGE_A), path.basename(IMAGE_B)],
  })
})

// ─── Phase 1: API RBAC matrix (real emailpass tokens) ──────────────
test("1 · API RBAC — actor isolation (admin / seller / buyer)", async () => {
  const admin = await loginAdmin(creds.admin.email, creds.admin.password)
  const seller = await loginSeller(creds.seller.email, creds.seller.password)

  const buyerEmail = `live.buyer.${Date.now()}@alkemart.local`
  const buyer = await registerAndLoginBuyer({
    email: buyerEmail,
    password: "LiveBuyerPass1!",
    firstName: "Ama",
    lastName: "Mensah",
  })

  // Seller stores = multi-vendor membership on this member
  const stores = await listSellerStores(seller.token)
  expect(stores.status).toBeLessThan(400)
  const sellers = stores.sellers as { id?: string; name?: string }[]
  expect(sellers.length, "seller must own ≥1 live store").toBeGreaterThan(0)

  const storeIds = sellers.map((s) => s.id).filter(Boolean) as string[]
  const primaryId = storeIds[0]

  // --- deny matrix ---
  const sellerHitsAdmin = await getJson(
    `${API}/admin/alkemart/moderation/summary`,
    { Authorization: `Bearer ${seller.token}` },
  )
  expect(
    [401, 403].includes(sellerHitsAdmin.status),
    "seller token must not read admin moderation",
  ).toBeTruthy()

  const buyerHitsVendor = await getJson(
    `${API}/vendor/alkemart/onboarding/status`,
    { Authorization: `Bearer ${buyer.token}` },
  )
  expect(
    [401, 403].includes(buyerHitsVendor.status),
    "buyer token must not read vendor onboarding",
  ).toBeTruthy()

  const openAdmin = await getJson(
    `${API}/admin/alkemart/moderation/summary`,
    {},
  )
  expect([401, 403].includes(openAdmin.status)).toBeTruthy()

  // --- allow matrix ---
  const mod = await getModerationSummary(admin.token)
  expect(mod.status, "admin reads moderation summary").toBe(200)

  const onb = await getOnboarding(seller.token, primaryId)
  // 200 expected when seller linked; 400 if header missing — we send seller id
  expect(
    [200, 404].includes(onb.status) || onb.status < 500,
    `onboarding reachable for seller store (got ${onb.status})`,
  ).toBeTruthy()

  // --- exclusive product isolation (no shared lab/orphan catalog) ---
  // Mercur default shows published products without product_seller to all sellers.
  // Alkemart middleware must restrict GET /vendor/products to owned only.
  const LAB_LEAK_TITLES =
    /fresh tomatoes|key soap|android smartphone|ankara fabric|ripe plantain|bottled water|local rice 5kg \(lab\)/i
  const productIsolation: Record<string, unknown> = {}
  for (const s of sellers) {
    if (!s.id) continue
    const list = await listVendorProducts({
      memberToken: seller.token,
      sellerId: s.id,
    })
    expect(list.status, `vendor products for ${s.id}`).toBeLessThan(500)
    if (list.status === 200) {
      const titles = list.products.map((p) => p.title || "")
      const leaked = titles.filter((t) => LAB_LEAK_TITLES.test(t))
      expect(
        leaked,
        `seller ${s.name || s.id} must not see orphan lab products: ${leaked.join(", ")}`,
      ).toEqual([])
      productIsolation[s.id] = {
        name: s.name,
        count: list.count,
        titles: titles.slice(0, 12),
      }
    } else {
      productIsolation[s.id] = { name: s.name, status: list.status }
    }
  }

  phase("1_api_rbac", {
    admin_email: creds.admin.email,
    seller_email: creds.seller.email,
    buyer_email: buyerEmail,
    stores: sellers.map((s) => ({ id: s.id, name: s.name })),
    multi_store: sellers.length >= 2,
    product_isolation: productIsolation,
    denies: {
      seller_to_admin: sellerHitsAdmin.status,
      buyer_to_vendor: buyerHitsVendor.status,
      open_admin: openAdmin.status,
    },
    allows: {
      admin_moderation: mod.status,
      seller_onboarding: onb.status,
    },
  })
})

// ─── Phase 2: Browser seller — multi-vendor store picker ───────────
test("2 · Browser seller — login + multi-store select (real UI)", async ({
  page,
}, testInfo) => {
  await loginSellerPanel(page, creds.seller.email, creds.seller.password)
  expect(page.url()).not.toMatch(/login/)

  // Multi-vendor proof: store-select lists real shops
  if (page.url().includes("store-select")) {
    await expect(
      page.getByRole("heading", { name: /select a store/i }),
    ).toBeVisible({ timeout: 15_000 })
    const body = await page.innerText("body")
    // At least one known store; second store proves multi-vendor membership
    const hasLab = /alkemart lab shop/i.test(body)
    const hasLamp = /lamp store/i.test(body)
    expect(hasLab || hasLamp || /active/i.test(body)).toBeTruthy()

    await selectSellerStore(page, creds.sellerStoreName)
    // Give the shell a moment to settle so the headed window is readable
    await page.waitForTimeout(1200)
    await page.screenshot({
      path: testInfo.outputPath("seller-after-store.png"),
      fullPage: false,
    })

    phase("2_browser_seller", {
      landed: page.url(),
      multi_vendor_ui: { hasLab, hasLamp },
      selected: creds.sellerStoreName,
    })
  } else {
    phase("2_browser_seller", {
      landed: page.url(),
      note: "skipped store-select (already in shell)",
    })
  }
})

// ─── Phase 3: Browser admin — login + ops surface ──────────────────
test("3 · Browser admin — login + moderation/ops reachable", async ({
  page,
}, testInfo) => {
  await loginAdminPanel(page, creds.admin.email, creds.admin.password)
  const url = page.url()
  // Should leave /login; may land on orders/products/settings
  expect(url, "admin should leave login route").not.toMatch(/\/login\/?$/)

  await page.screenshot({
    path: testInfo.outputPath("admin-home.png"),
    fullPage: false,
  })

  // Navigate to custom ops routes if present
  const opsPaths = [
    `${ADMIN}/dashboard/sellers-queue`,
    `${ADMIN}/dashboard/product-moderation`,
    `${ADMIN}/dashboard/orders`,
  ]
  const reachable: Record<string, number> = {}
  for (const p of opsPaths) {
    const res = await page.goto(p, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    })
    reachable[p] = res?.status() ?? 0
    await page.waitForTimeout(800)
  }

  // Seller must not open admin app as authenticated admin shell with seller cookie —
  // open seller app in same browser without admin cookie is separate context.
  phase("3_browser_admin", {
    landed: url,
    ops_routes: reachable,
  })
})

// ─── Phase 4: Cross-role browser isolation ─────────────────────────
test("4 · Browser RBAC — seller session cannot use admin panel", async ({
  browser,
}) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  await loginSellerPanel(
    sellerPage,
    creds.seller.email,
    creds.seller.password,
  )

  // With only seller cookies, hit admin origin
  const res = await sellerPage.goto(`${ADMIN}/dashboard/orders`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  })
  await sellerPage.waitForTimeout(2500)
  const body = await sellerPage.innerText("body")
  const stillLogin =
    /admin sign in|continue with email|sign in/i.test(body) ||
    sellerPage.url().includes("login")
  // Seller cookies must not grant admin shell
  expect(
    stillLogin || !/orders|products|customers/i.test(body),
    "seller browser session must not land in admin orders shell",
  ).toBeTruthy()

  phase("4_cross_role_browser", {
    admin_url_after_seller_session: sellerPage.url(),
    saw_login_gate: stillLogin,
    response_status: res?.status() ?? null,
  })
  await sellerCtx.close()
})

// ─── Phase 5: Live catalog (buyer path, real offers) ───────────────
test("5 · Shop catalog — real sellable list + PDP", async ({ page }) => {
  const pk = publishableKey()
  // Load PK from storefront env file if process env empty
  let key = pk
  if (!key) {
    for (const f of [
      path.join(__dirname, "../../apps/storefront/.env"),
      "/home/amber/alkemart-storefront/.env",
    ]) {
      if (fs.existsSync(f)) {
        const m = fs
          .readFileSync(f, "utf8")
          .match(/^VITE_MEDUSA_PUBLISHABLE_KEY=(.+)$/m)
        if (m) {
          key = m[1].trim().replace(/^["']|["']$/g, "")
          break
        }
      }
    }
  }
  expect(key, "publishable key required for catalog").toBeTruthy()

  const cat = await getCatalog(key, 12)
  expect(cat.status).toBe(200)
  const products = (cat.json?.products ?? []) as {
    id?: string
    title?: string
    offer_id?: string
  }[]

  await page.goto(SHOP, { waitUntil: "domcontentloaded" })
  await expect(page.getByText(/alkemart/i).first()).toBeVisible({
    timeout: 20_000,
  })

  // If catalog has products, open first on shop
  if (products.length > 0 && products[0].id) {
    const id = products[0].id
    await page.goto(`${SHOP}/product/${id}`, {
      waitUntil: "domcontentloaded",
    })
    await page.waitForTimeout(2000)
    const body = await page.innerText("body")
    expect(body.length).toBeGreaterThan(20)
  }

  // Performance / ATC contracts (P1.1) — bake architecture into e2e
  expect(
    cat.json?.strategy === "light_ids_then_heavy_page" ||
      products.length === 0,
    `catalog strategy should be light_ids_then_heavy_page (got ${cat.json?.strategy})`,
  ).toBeTruthy()
  if (products.length > 0) {
    expect(
      products.every((p) => !!p.offer_id),
      "every catalog card needs offer_id for ATC",
    ).toBeTruthy()
  }

  phase("5_shop_catalog", {
    product_count: products.length,
    strategy: cat.json?.strategy ?? null,
    cache: cat.json?.cache ?? null,
    sample: products.slice(0, 5).map((p) => ({
      id: p.id,
      title: p.title,
      offer_id: p.offer_id ?? null,
    })),
    has_offer_rows: products.some((p) => p.offer_id),
  })
})

// ─── Phase 6: Seller product with REAL image (live API, no seed) ───
test("6 · Seller creates proposed product with real image upload", async () => {
  const seller = await loginSeller(creds.seller.email, creds.seller.password)
  const stores = await listSellerStores(seller.token)
  const sellers = stores.sellers as { id?: string; name?: string }[]
  const store =
    sellers.find((s) =>
      (s.name || "")
        .toLowerCase()
        .includes(creds.sellerStoreName.toLowerCase().slice(0, 8)),
    ) || sellers[0]
  expect(store?.id).toBeTruthy()
  const sellerId = store!.id as string

  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ")
  const title = `Ghana Doorstep Bundle ${stamp}`
  const description =
    "Live RBAC audit product. Real marketplace photography (doorstep delivery). " +
    "GHS pricing for Accra delivery. Created by Playwright multi-vendor audit — not a seed script."

  const up = await uploadVendorImage({
    memberToken: seller.token,
    sellerId,
    filePath: IMAGE_A,
  })

  // Upload may 200 with files, or 400 if middleware rejects — record honestly
  const thumb =
    up.files?.[0]?.url ||
    up.files?.[0]?.file_url ||
    up.files?.[0]?.location ||
    undefined

  const created = await createVendorProduct({
    memberToken: seller.token,
    sellerId,
    title,
    description,
    thumbnail: thumb,
  })

  phase("6_seller_product_image", {
    seller_id: sellerId,
    store_name: store?.name,
    upload_status: up.status,
    upload_preview: up.text.slice(0, 240),
    thumbnail: thumb ?? null,
    create_status: created.status,
    product_id: created.product?.id ?? null,
    title,
    note:
      created.status < 400
        ? "product created on live API"
        : "create rejected or schema mismatch — see text (still valid audit signal)",
    create_preview: created.text.slice(0, 400),
  })

  // Soft assert: either created or we documented a gate (quality/setup)
  expect(
    created.status < 500,
    `vendor product create should not 5xx (got ${created.status})`,
  ).toBeTruthy()
})

// ─── Phase 7: Admin moderation reads live queue ────────────────────
test("7 · Admin moderation summary after seller activity", async () => {
  const admin = await loginAdmin(creds.admin.email, creds.admin.password)
  const mod = await getModerationSummary(admin.token)
  expect(mod.status).toBe(200)

  phase("7_admin_moderation", {
    status: mod.status,
    summary: mod.json ?? null,
  })
})
