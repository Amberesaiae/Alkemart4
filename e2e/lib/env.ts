/**
 * Live E2E config — real hosts + credentials from env only.
 * No seed scripts, no fixture DB injection.
 *
 * Defaults match documented lab accounts that already exist in Neon.
 * Override with E2E_* env vars for staging.
 */

export const API = (process.env.API_URL ?? "http://localhost:9000").replace(
  /\/$/,
  "",
)
/** Prefer localhost (cookie + CORS match panel vite config) */
export const SHOP = process.env.SHOP_URL ?? "http://localhost:5175"
export const ADMIN = process.env.ADMIN_URL ?? "http://localhost:7000"
export const SELLER = process.env.SELLER_URL ?? "http://localhost:7001"

export const creds = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@alkemart.local",
    password: process.env.E2E_ADMIN_PASSWORD ?? "supersecret",
  },
  seller: {
    // After lab purge, default to production-like Amberstone vendor
    email: process.env.E2E_SELLER_EMAIL ?? "amberstone@gmail.com",
    password: process.env.E2E_SELLER_PASSWORD ?? "aero1302",
  },
  /** Prefer existing store name on the seller account (multi-vendor proof) */
  sellerStoreName:
    process.env.E2E_SELLER_STORE_NAME ?? "Amberstone Market",
}

export function publishableKey(): string {
  return (
    process.env.E2E_PUBLISHABLE_KEY ||
    process.env.VITE_MEDUSA_PUBLISHABLE_KEY ||
    process.env.PK ||
    ""
  ).trim()
}
