import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { requireSeller } from "../../middleware/auth"
import type { NotificationPreferenceDto, OrderRow, PayoutRow } from "../../checkout-repository"
import type { VendorProductDto } from "../../catalog-repository"

export type VendorTask = {
  kind:
    | "approval"
    | "changes"
    | "drafts"
    | "dispatch"
    | "logo"
    | "momo"
    | "address"
    | "stock"
    | "price"
    | "sla"
    | "payout"
  title: string
  detail: string
  href: string
  count: number
}

const LOW_STOCK_AT = 5
const STALE_PRICE_MS = 72 * 3_600_000
const SLA_PLACED_MS = 24 * 3_600_000

/** GET /vendor/tasks — what needs this seller's attention, most urgent first. */
export const vendorTasks = new Hono<AppEnv>().use("*", requireSeller).get("/", async (c) => {
  const sellerId = c.get("auth").sellerId
  if (!sellerId) return c.json({ tasks: [] as VendorTask[] })

  const [seller, products, orders] = await Promise.all([
    c.get("authRepo").findSellerById(sellerId),
    c.get("repo").listVendorProducts(sellerId).catch((): VendorProductDto[] => []),
    c.get("checkoutRepo").listOrdersForSeller(sellerId).catch((): OrderRow[] => []),
  ])
  if (!seller) return c.json({ tasks: [] as VendorTask[] })

  // Phase 7C — alert topics. Opting a topic out hides its journey tasks;
  // everything is on by default.
  const prefs = await c
    .get("checkoutRepo")
    .listNotificationPreferences("seller", sellerId)
    .catch((): NotificationPreferenceDto[] => [])
  const off = new Set(
    prefs
      .filter((p) => p.channel === "dashboard" && p.category === "operational" && !p.optedIn && p.topic)
      .map((p) => p.topic as string),
  )
  const on = (topic: string) => !off.has(topic)

  const tasks: VendorTask[] = []
  if (seller.status === "pending_approval") {
    tasks.push({
      kind: "approval",
      title: "Waiting for ops approval",
      detail: "Your shop goes live as soon as the ops team approves it.",
      href: "/settings",
      count: 1,
    })
  }
  const rejected = products.filter((p) => p.product.status === "rejected").length
  if (rejected > 0) {
    tasks.push({
      kind: "changes",
      title: `${rejected} product${rejected === 1 ? "" : "s"} need${rejected === 1 ? "s" : ""} changes`,
      detail: "Review the feedback and re-submit for review.",
      href: "/products",
      count: rejected,
    })
  }
  const toDispatch = orders.filter((o) => o.status === "placed").length
  if (toDispatch > 0) {
    tasks.push({
      kind: "dispatch",
      title: `${toDispatch} order${toDispatch === 1 ? "" : "s"} to dispatch`,
      detail: "Pack and hand them to your rider.",
      href: "/orders",
      count: toDispatch,
    })
  }
  const drafts = products.filter((p) => p.product.status === "draft").length
  if (drafts > 0) {
    tasks.push({
      kind: "drafts",
      title: `${drafts} draft${drafts === 1 ? "" : "s"} not submitted`,
      detail: "Submit them for review to go live.",
      href: "/products",
      count: drafts,
    })
  }
  if (!seller.logo) {
    tasks.push({
      kind: "logo",
      title: "Add a shop logo",
      detail: "Shops with logos earn more trust.",
      href: "/settings?tab=profile",
      count: 1,
    })
  }
  if (!seller.packRegion) {
    tasks.push({
      kind: "address",
      title: "Set your dispatch address",
      detail: "Riders need to know where to pick up.",
      href: "/settings?tab=dispatch",
      count: 1,
    })
  }
  if (!seller.momoPhone) {
    tasks.push({
      kind: "momo",
      title: "Set up MoMo payouts",
      detail: "You can't get paid without it.",
      href: "/settings?tab=momo",
      count: 1,
    })
  }
  // Phase 7C seller journeys — each leads to the task that clears it.
  if (on("stock")) {
    const low = products
      .filter((p) => p.product.status === "published")
      .flatMap((p) => p.variants)
      .filter((v) => v.offer.active && v.offer.onHand > 0 && v.offer.onHand <= LOW_STOCK_AT).length
    if (low > 0) {
      tasks.push({
        kind: "stock",
        title: `${low} combination${low === 1 ? "" : "s"} running low`,
        detail: "Restock before the next buyer meets a strikethrough.",
        href: "/products",
        count: low,
      })
    }
  }
  if (on("price")) {
    const now = Date.now()
    // Published listings whose price was never verified (or not for 72h)
    // mislead buyers; drafts are still being written, so they stay quiet.
    const stale = products
      .filter((p) => p.product.status === "published")
      .flatMap((p) => p.variants)
      .filter((v) => {
        if (!v.offer.active) return false
        if (!v.offer.freshnessAt) return true
        const at = Date.parse(v.offer.freshnessAt)
        return !Number.isFinite(at) || now - at > STALE_PRICE_MS
      }).length
    if (stale > 0) {
      tasks.push({
        kind: "price",
        title: `${stale} price${stale === 1 ? "" : "s"} need${stale === 1 ? "s" : ""} a freshness check`,
        detail: "Confirm price and stock so stale offers suppress honestly.",
        href: "/products",
        count: stale,
      })
    }
  }
  if (on("sla")) {
    const checkout = c.get("checkoutRepo")
    const groups = new Map<string, string>()
    await Promise.all(
      [...new Set(orders.filter((o) => o.status === "placed").map((o) => o.orderGroupId))].map(
        async (gid) => {
          const group = await checkout.getOrderGroup(gid).catch(() => null)
          const at = (group as { createdAt?: Date } | null)?.createdAt
          if (at) groups.set(gid, at.toISOString())
        },
      ),
    )
    const now = Date.now()
    const overdue = orders.filter((o) => {
      if (o.status !== "placed") return false
      const at = groups.get(o.orderGroupId)
      if (!at) return false
      return now - Date.parse(at) > SLA_PLACED_MS
    }).length
    if (overdue > 0) {
      tasks.push({
        kind: "sla",
        title: `${overdue} order${overdue === 1 ? "" : "s"} waiting over a day`,
        detail: "Dispatch before buyers lose patience.",
        href: "/orders",
        count: overdue,
      })
    }
  }
  if (on("payout")) {
    const payouts = await c
      .get("checkoutRepo")
      .listPayoutsForSeller(sellerId)
      .catch((): (PayoutRow & { createdAt: Date | null })[] => [])
    const failed = payouts.filter((p) => p.status === "failed").length
    if (failed > 0) {
      tasks.push({
        kind: "payout",
        title: `${failed} payout${failed === 1 ? "" : "s"} failed`,
        detail: "Check the Money tab and contact support with the reference.",
        href: "/money",
        count: failed,
      })
    }
  }
  return c.json({ tasks })
})
