import { test, expect } from "@playwright/test"

const SHOP = process.env.SHOP_URL ?? "http://localhost:5175"
const ADMIN = process.env.ADMIN_URL ?? "http://localhost:7000"
const SELLER = process.env.SELLER_URL ?? "http://localhost:7001"
const API = process.env.API_URL ?? "http://localhost:9000"

test.describe("surface smoke (prod-ready layer 3)", () => {
  test("API health", async ({ request }) => {
    const res = await request.get(`${API}/health`)
    expect(res.ok()).toBeTruthy()
  })

  test("storefront home loads alkemart brand", async ({ page }) => {
    // domcontentloaded — avoid networkidle hangs on PostHog / analytics
    await page.goto(SHOP, { waitUntil: "domcontentloaded" })
    await expect(page.getByText(/alkemart/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator("body")).toBeVisible()
  })

  test("storefront sign-in shows language control", async ({ page }) => {
    await page.goto(`${SHOP}/signin`, { waitUntil: "domcontentloaded" })
    await expect(page.getByTestId("auth-language-select-trigger")).toBeVisible({
      timeout: 15_000,
    })
  })

  test("admin login surface", async ({ page }) => {
    await page.goto(ADMIN, { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("heading", { name: /admin sign in|sign in|welcome/i }),
    ).toBeVisible({ timeout: 25_000 })
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible()
  })

  test("seller login surface", async ({ page }) => {
    await page.goto(SELLER, { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("heading", { name: /seller sign in|sign in|welcome/i }),
    ).toBeVisible({ timeout: 25_000 })
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible()
    await expect(page.getByTestId("auth-language-select-trigger")).toBeVisible({
      timeout: 15_000,
    })
  })
})
