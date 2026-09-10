import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { requireSeller } from "../../middleware/auth"
import type { OrderRow } from "../../checkout-repository"
import type { VendorProductDto } from "../../catalog-repository"

export type VendorTask = {
  kind: "approval" | "changes" | "drafts" | "dispatch" | "logo" | "momo" | "address"
  title: string
  detail: string
  href: string
  count: number
}

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
  return c.json({ tasks })
})
