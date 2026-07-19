import type { Page } from "@playwright/test"
import { ADMIN, SELLER } from "./env"

/** Mercur panel login — real form, real emailpass. */
export async function loginAdminPanel(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto(`${ADMIN}/dashboard/login`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  })
  await page.waitForSelector('input[type="email"], input[name="email"]', {
    timeout: 30_000,
  })
  await page.locator('input[type="email"], input[name="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page
    .getByRole("button", { name: /continue with email|continue|log in|sign in/i })
    .first()
    .click()
  // Leave login URL
  await page.waitForFunction(
    () => !/\/login\/?$/.test(window.location.pathname),
    null,
    { timeout: 45_000 },
  ).catch(() => {
    /* may stay if error — caller asserts */
  })
  await page.waitForTimeout(1500)
}

export async function loginSellerPanel(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto(`${SELLER}/seller/login`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  })
  await page.waitForSelector('input[type="email"], input[name="email"]', {
    timeout: 30_000,
  })
  await page.locator('input[type="email"], input[name="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole("button", { name: /log in|continue|sign in/i }).first().click()
  await page.waitForURL(/store-select|orders|products|seller\/?$/, {
    timeout: 45_000,
  })
  await page.waitForTimeout(1500)
}

/** Multi-vendor store picker — selects an existing live store by name. */
export async function selectSellerStore(page: Page, storeName: string) {
  if (!page.url().includes("store-select")) {
    // Already inside a store shell
    return
  }
  // Prefer a clickable store card/button containing the name
  const byRole = page
    .getByRole("button", { name: new RegExp(storeName, "i") })
    .first()
  if (await byRole.count()) {
    await byRole.click()
  } else {
    await page.getByText(storeName, { exact: false }).first().click()
  }
  await page
    .waitForURL((url) => !url.pathname.includes("store-select"), {
      timeout: 30_000,
    })
    .catch(() => {
      /* stay on select if click missed — caller records */
    })
  await page.waitForTimeout(1500)
}
