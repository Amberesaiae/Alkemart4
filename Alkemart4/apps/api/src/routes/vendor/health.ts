import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { requireSeller } from "../../middleware/auth"
import type { OrderRow } from "../../checkout-repository"
import type { VendorProductDto } from "../../catalog-repository"

export type HealthState = "healthy" | "attention" | "blocked"
export type HealthItem = {
  key: string
  label: string
  detail: string
  state: HealthState
  href: string
}

/**
 * GET /vendor/health — account standing scorecard (read-only).
 * Overall is blocked when the shop isn't open, attention when any check
 * needs work, healthy otherwise.
 */
export const vendorHealth = new Hono<AppEnv>().use("*", requireSeller).get("/", async (c) => {
  const sellerId = c.get("auth").sellerId
  if (!sellerId) throw new HTTPException(403, { message: "forbidden" })

  const [seller, products, orders] = await Promise.all([
    c.get("authRepo").findSellerById(sellerId),
    c.get("repo").listVendorProducts(sellerId).catch((): VendorProductDto[] => []),
    c.get("checkoutRepo").listOrdersForSeller(sellerId).catch((): OrderRow[] => []),
  ])
  if (!seller) throw new HTTPException(404, { message: "seller not found" })

  const items: HealthItem[] = []
  if (seller.status !== "open") {
    items.push({
      key: "standing",
      label: "Shop standing",
      detail:
        seller.status === "pending_approval"
          ? "Waiting for ops approval — you can list, but buyers can't order yet."
          : `Your shop is ${seller.status}. Contact support to restore it.`,
      state: "blocked",
      href: "/settings",
    })
  }
  if (!seller.logo || !seller.description) {
    items.push({
      key: "profile",
      label: "Shop profile",
      detail: !seller.logo && !seller.description
        ? "Add a logo and a shop description to earn buyer trust."
        : !seller.logo
          ? "Add a shop logo to earn buyer trust."
          : "Add a shop description to tell buyers who you are.",
      state: "attention",
      href: "/settings?tab=profile",
    })
  }
  if (!seller.momoPhone || !seller.recipientCode) {
    items.push({
      key: "payout",
      label: "Payout readiness",
      detail: "No MoMo payout destination — you can't get paid yet.",
      state: "attention",
      href: "/settings?tab=momo",
    })
  }
  const published = products.filter((p) => p.product.status === "published").length
  if (published === 0) {
    items.push({
      key: "catalog",
      label: "Live catalog",
      detail: "No published products — nothing for buyers to find.",
      state: "attention",
      href: "/products",
    })
  }
  if (orders.length >= 3) {
    const delivered = orders.filter((o) => o.status === "delivered").length
    const rate = delivered / orders.length
    if (rate < 0.5) {
      items.push({
        key: "fulfillment",
        label: "Fulfillment health",
        detail: `Only ${Math.round(rate * 100)}% of orders delivered — dispatch faster to protect your standing.`,
        state: "attention",
        href: "/orders",
      })
    }
  }

  const overall: HealthState =
    items.some((i) => i.state === "blocked")
      ? "blocked"
      : items.length > 0
        ? "attention"
        : "healthy"
  return c.json({ status: overall, items })
})
