import { test, expect } from "@playwright/test"
import { SELLER, API, creds } from "../lib/env"
import { loginSeller, listSellerStores, createVendorProduct, uploadVendorImage } from "../lib/api"
import path from "node:path"

const FIXTURE_IMG = path.join(__dirname, "..", "fixtures", "images", "ghana-marketplace.png")

test.describe("seller onboarding & product management", () => {
  let sellerToken: string
  let sellerId: string

  test.beforeAll(async () => {
    const r = await loginSeller(creds.seller.email, creds.seller.password)
    sellerToken = r.token

    const stores = await listSellerStores(sellerToken)
    expect(stores.sellers.length).toBeGreaterThan(0)
    sellerId = stores.sellers[0].id!
    expect(sellerId).toBeTruthy()
  })

  test("seller can view onboarding status", async ({ request }) => {
    const res = await request.get(`${API}/vendor/alkemart/onboarding/status`, {
      headers: {
        Authorization: `Bearer ${sellerToken}`,
        "x-seller-id": sellerId,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toBeDefined()
  })

  test("seller can upload product image", async () => {
    const result = await uploadVendorImage({
      memberToken: sellerToken,
      sellerId,
      filePath: FIXTURE_IMG,
    })
    expect(result.status).toBe(200)
    expect(result.files.length).toBeGreaterThan(0)
  })

  test("seller can create a proposed product", async () => {
    const ts = Date.now()
    const result = await createVendorProduct({
      memberToken: sellerToken,
      sellerId,
      title: `E2E Test Product ${ts}`,
      description: "Created during automated E2E test",
    })
    expect(result.status).toBe(200)
    expect(result.product?.id).toBeTruthy()
    expect(result.product?.status).toBe("proposed")
  })

  test("seller can list their products", async () => {
    const res = await fetch(`${API}/vendor/products?limit=10&fields=id,title,status`, {
      headers: {
        Authorization: `Bearer ${sellerToken}`,
        "x-seller-id": sellerId,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const products = body?.products ?? []
    expect(Array.isArray(products)).toBeTruthy()
  })

  test("seller can access seller dashboard", async ({ page }) => {
    await page.goto(`${SELLER}/seller/login`, { waitUntil: "domcontentloaded" })
    await page.locator('input[type="email"]').first().fill(creds.seller.email)
    await page.locator('input[type="password"]').first().fill(creds.seller.password)
    await page.getByRole("button", { name: /log in|continue|sign in/i }).first().click()
    await page.waitForURL(/store-select|orders|products|seller\/?$/, { timeout: 45_000 })
    await expect(page.locator("body")).toBeVisible()
  })
})
