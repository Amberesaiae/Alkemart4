import { defineConfig, devices } from "@playwright/test"

/**
 * Layer 3 — browser smoke / live RBAC against local dev surfaces.
 * Requires servers up: API :9000, shop :5175, admin :7000, seller :7001.
 *
 * Headed watch mode (slow, visible Chrome):
 *   cd e2e && bun run test:rbac:headed
 *   # or: HEADED=1 SLOW_MO=400 bun run test:rbac
 */
const headed =
  process.env.HEADED === "1" ||
  process.env.HEADED === "true" ||
  process.argv.includes("--headed")
const slowMo = Number(process.env.SLOW_MO ?? (headed ? "450" : "0")) || 0

export default defineConfig({
  testDir: "./tests",
  fullyParallel: !headed,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI || headed ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: headed ? 180_000 : 90_000,
  expect: { timeout: headed ? 30_000 : 20_000 },
  use: {
    headless: headed ? false : true,
    launchOptions: {
      slowMo,
      // Keep window visible long enough to watch multi-step RBAC
      args: headed ? ["--start-maximized"] : [],
    },
    viewport: headed ? null : { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: headed ? "on" : "only-on-failure",
    video: headed ? "on" : "off",
    // localhost matches panel vite + CORS (avoid 127.0.0.1 cookie splits)
    baseURL: process.env.SHOP_URL ?? "http://localhost:5175",
    actionTimeout: headed ? 20_000 : 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
