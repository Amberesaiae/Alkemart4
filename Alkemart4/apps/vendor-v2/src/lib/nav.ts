import type { IconSvgElement } from "@hugeicons/react"
import { DeliveryBox01Icon, Home01Icon, Store04Icon, Tag01Icon, Wallet01Icon } from "@hugeicons/core-free-icons"
import type { TaskKind } from "./api"

/**
 * The five seller destinations (CONSOLE-REDESIGN §3). Same list on the phone
 * tab bar and the desktop sidebar; Account sits behind the shop avatar.
 */
export const NAV: { to: "/" | "/orders" | "/products" | "/money" | "/shop"; label: string; icon: IconSvgElement }[] = [
  { to: "/", label: "Home", icon: Home01Icon },
  { to: "/orders", label: "Orders", icon: DeliveryBox01Icon },
  { to: "/products", label: "Products", icon: Tag01Icon },
  { to: "/money", label: "Money", icon: Wallet01Icon },
  { to: "/shop", label: "Shop", icon: Store04Icon },
]

/**
 * Where each to-do goes in THIS app. The API's `href` points at the old
 * vendor app's routes, so tasks are routed by `kind` instead.
 * `null` = informational (nothing for the seller to click).
 */
type TaskRoute =
  | { to: "/orders"; search: { tab: "to-pack" | "returns" } }
  | { to: "/products"; search?: { status: "needs-changes" | "draft" | "low-stock" } }
  | { to: "/products/new"; search?: undefined }
  | { to: "/shop"; search?: { section: "profile" | "location" } }
  | { to: "/money" | "/account"; search?: undefined }

export const TASK_ROUTE: Record<TaskKind, TaskRoute | null> = {
  approval: null,
  dispatch: { to: "/orders", search: { tab: "to-pack" } },
  sla: { to: "/orders", search: { tab: "to-pack" } },
  changes: { to: "/products", search: { status: "needs-changes" } },
  drafts: { to: "/products", search: { status: "draft" } },
  stock: { to: "/products", search: { status: "low-stock" } },
  price: { to: "/products" },
  logo: { to: "/shop", search: { section: "profile" } },
  momo: { to: "/money" },
  payout: { to: "/money" },
  address: { to: "/shop", search: { section: "location" } },
  returns: { to: "/orders", search: { tab: "returns" } },
}
