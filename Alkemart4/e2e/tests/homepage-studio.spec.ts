import { test, expect } from "@playwright/test"

const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3001"

/**
 * Homepage Studio — accessibility + merchandising interaction coverage.
 * Requires local dev servers (API :8787, admin :3001) with seeded demo accounts.
 */
test.describe("homepage studio", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ADMIN}/login`, { waitUntil: "domcontentloaded" })
    // Cold vite dev can take ~60s to transform the admin bundle on first hit.
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 60_000 })
    await page.locator('input[name="email"]').fill(process.env.ADMIN_EMAIL ?? "admin@alkemart.test")
    await page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD ?? "AdminPass1")
    await page.getByRole("button", { name: /sign in|log in/i }).click()
    // Wait for the post-login redirect before entering the studio.
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 25_000 })
    await page.goto(`${ADMIN}/homepage`, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "Homepage Studio" })).toBeVisible({ timeout: 60_000 })
  })

  test("landmarks, skip links, and labelled controls", async ({ page }) => {
    await expect(page.getByRole("navigation", { name: "Homepage sections" })).toBeVisible()
    await expect(page.getByRole("tablist", { name: "Preview perspective" })).toBeVisible()
    await expect(page.getByRole("group", { name: "Preview width" })).toBeVisible()

    // Skip links become visible on focus.
    const skip = page.getByRole("link", { name: "Skip to section settings" })
    await skip.focus()
    await expect(skip).toBeVisible()

    // Every visible form control must expose an accessible name.
    const violations = await page.evaluate(() => {
      const bad: string[] = []
      const els = Array.from(document.querySelectorAll("input, textarea, select, [role='combobox'], [role='switch']"))
      for (const el of els) {
        const rect = (el as HTMLElement).getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        const html = el as HTMLInputElement
        const labelled =
          (html.labels?.length ?? 0) > 0 ||
          el.getAttribute("aria-label") ||
          el.getAttribute("aria-labelledby")
        if (!labelled) bad.push(el.outerHTML.slice(0, 120))
      }
      return bad
    })
    expect(violations).toEqual([])
  })

  test("draft preview shows edits and selects blocks for editing", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Draft" })).toHaveAttribute("aria-selected", "true")
    const blocks = page.getByRole("button", { name: /^Edit .* position \d+ of \d+/ })
    await expect(blocks.first()).toBeVisible()
    await blocks.first().click()
    await expect(page.locator("#studio-settings h2").first()).toBeFocused()
  })

  test("live perspective renders the real published page", async ({ page }) => {
    await page.getByRole("tab", { name: "Live page" }).click()
    await expect(page.getByTitle("Live preview of the storefront homepage")).toBeVisible()
  })

  test("device toggle resizes the preview", async ({ page }) => {
    const widthGroup = page.getByRole("group", { name: "Preview width" })
    const maxWidth = () => page.evaluate(() => {
      const block = document.querySelector('#studio-preview [role="button"]')
      const wrap = block?.closest('div[class*="max-w"]')
      return wrap ? getComputedStyle(wrap).maxWidth : ""
    })
    await widthGroup.getByRole("button", { name: "Mobile", exact: true }).click()
    // The wrapper animates max-width (transition-all) — poll until it settles.
    await expect.poll(maxWidth).toBe("390px")
    await widthGroup.getByRole("button", { name: "Desktop", exact: true }).click()
    await expect.poll(maxWidth).not.toBe("390px")
  })

  test("keyboard reorder announces the new position", async ({ page }) => {
    const first = page.locator("[id^='section-item-']").first()
    await first.focus()
    await page.keyboard.press("Alt+ArrowDown")
    await expect(page.getByRole("status").first()).toContainText(/moved to position 2 of \d+/)
  })

  test("eye toggle hides and shows with pressed state", async ({ page }) => {
    const toggle = page.getByRole("button", { name: /^(Hide|Show) / }).first()
    const before = await toggle.getAttribute("aria-pressed")
    await toggle.click()
    const after = await toggle.getAttribute("aria-pressed")
    expect(before).not.toBe(after)
  })

  test("schedule picker is click-and-choose with month/year dropdowns", async ({ page }) => {
    await page.getByRole("button", { name: "Schedule", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // The calendar lives in a nested popover — open the Publish-at date first.
    await dialog.getByRole("button", { name: "Publish at", exact: true }).click()
    const calendar = page.getByRole("dialog").last()
    await expect(calendar.getByRole("combobox", { name: "Choose month" })).toBeVisible()
    await expect(calendar.getByRole("combobox", { name: "Choose year" })).toBeVisible()

    // Jump a year ahead via dropdown, pick a day, pick a time preset.
    await calendar.getByRole("combobox", { name: "Choose year" }).click()
    const nextYear = String(new Date().getFullYear() + 1)
    await page.getByRole("option", { name: nextYear, exact: true }).click()
    await calendar.getByRole("button", { name: new RegExp(`15 \\w+ ${nextYear}`) }).click()
    await calendar.getByRole("button", { name: "Midday" }).click()
    await calendar.getByRole("button", { name: "Done" }).click()
    // Wait for the calendar popover to close so "Done" is unambiguous.
    await expect(calendar.getByRole("combobox", { name: "Choose month" })).toBeHidden()
    await dialog.getByRole("button", { name: "Done" }).click()
    await expect(page.getByRole("button", { name: /Scheduled for/ })).toBeVisible()
  })

  test("touch targets meet 24px minimum in the studio", async ({ page }) => {
    const small = await page.evaluate(() => {
      const bad: string[] = []
      const root = document.querySelector("#studio-settings, nav[aria-label='Homepage sections']")
      const scope = root ?? document
      for (const el of Array.from(scope.querySelectorAll("button, input[type='checkbox'], [role='switch']"))) {
        const r = (el as HTMLElement).getBoundingClientRect()
        if (r.width === 0 && r.height === 0) continue
        if (r.width < 24 || r.height < 24) bad.push(`${el.tagName} ${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40)} ${Math.round(r.width)}x${Math.round(r.height)}`)
      }
      return bad
    })
    expect(small).toEqual([])
  })
})
