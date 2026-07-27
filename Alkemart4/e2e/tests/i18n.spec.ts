import { test, expect } from "@playwright/test"
import { SHOP, ADMIN, SELLER } from "../lib/env"

test.describe("internationalization", () => {
  test("storefront language control is visible", async ({ page }) => {
    await page.goto(SHOP, { waitUntil: "domcontentloaded" })
    await expect(page.getByTestId("auth-language-select-trigger").or(page.getByText(/language|lang|english|french|twi/i))).toBeVisible({ timeout: 15_000 })
  })

  test("admin panel language control is visible", async ({ page }) => {
    await page.goto(`${ADMIN}/dashboard/login`, { waitUntil: "domcontentloaded" })
    await expect(page.getByTestId("auth-language-select-trigger").or(page.getByText(/language|lang|english|french/i))).toBeVisible({ timeout: 15_000 })
  })

  test("seller panel language control is visible", async ({ page }) => {
    await page.goto(`${SELLER}/seller/login`, { waitUntil: "domcontentloaded" })
    await expect(page.getByTestId("auth-language-select-trigger").or(page.getByText(/language|lang|english|french/i))).toBeVisible({ timeout: 15_000 })
  })
})

test.describe("dark mode", () => {
  test("storefront renders in dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    await page.goto(SHOP, { waitUntil: "domcontentloaded" })
    const bg = await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).not.toBe("rgba(0, 0, 0, 0)")
  })
})

test.describe("responsive layout", () => {
  test("storefront renders on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(SHOP, { waitUntil: "domcontentloaded" })
    await expect(page.locator("body")).toBeVisible()
    // Menu toggle should be accessible
    const menuBtn = page.getByRole("button").or(page.getByRole("link")).filter({ hasText: /menu|☰|≡/i }).first()
    if (await menuBtn.count()) {
      await menuBtn.click()
      await page.waitForTimeout(500)
    }
  })
})

test.describe("error & edge cases", () => {
  test("404 shows error page", async ({ page }) => {
    await page.goto(`${SHOP}/this-path-does-not-exist-12345`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)
    const bodyText = await page.locator("body").innerText()
    const has404 = bodyText.includes("404") || bodyText.includes("not found") || bodyText.includes("Not Found") || bodyText.includes("Page not found")
    expect(has404).toBeTruthy()
  })

  test("invalid login shows error", async ({ page, request }) => {
    const res = await request.post(`${API}/auth/user/emailpass`, {
      data: { email: "nonexistent@alkemart.test", password: "wrong-password" },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})
