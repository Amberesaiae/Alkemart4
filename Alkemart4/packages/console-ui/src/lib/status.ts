/**
 * One status vocabulary for the consoles (and matching storefront-v2), so an
 * order, listing or seller reads the same word and colour everywhere.
 * See docs/architecture/workers/CONSOLE-REDESIGN.md §5.
 *
 * Domain enums come from @alkemart/domain; the audience picks the wording:
 * sellers get plain job words, operators get the precise state.
 */

export type Audience = "seller" | "admin"
export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "danger"

type Entry = { seller: string; admin: string; tone: Tone }

const ORDER: Record<string, Entry> = {
  placed: { seller: "To pack", admin: "Placed", tone: "brand" },
  shipped: { seller: "On the way", admin: "Shipped", tone: "info" },
  delivered: { seller: "Delivered", admin: "Delivered", tone: "success" },
  cancelled: { seller: "Cancelled", admin: "Cancelled", tone: "neutral" },
}

/** `changes_requested` is not a domain status (the product stays `proposed`); callers derive it from the review note. */
const LISTING: Record<string, Entry> = {
  draft: { seller: "Draft", admin: "Draft", tone: "neutral" },
  proposed: { seller: "In review", admin: "Needs review", tone: "info" },
  changes_requested: { seller: "Needs changes", admin: "Changes requested", tone: "warning" },
  published: { seller: "Live", admin: "Live", tone: "success" },
  rejected: { seller: "Not approved", admin: "Rejected", tone: "danger" },
  out_of_stock: { seller: "Out of stock", admin: "Out of stock", tone: "warning" },
}

const SELLER: Record<string, Entry> = {
  pending_approval: { seller: "Waiting for approval", admin: "Application", tone: "info" },
  open: { seller: "Open", admin: "Active", tone: "success" },
  suspended: { seller: "Suspended", admin: "Suspended", tone: "danger" },
  terminated: { seller: "Closed", admin: "Terminated", tone: "neutral" },
}

const PAYOUT: Record<string, Entry> = {
  pending: { seller: "On the way to you", admin: "Due", tone: "info" },
  held: { seller: "On hold", admin: "Held", tone: "warning" },
  paid: { seller: "Paid", admin: "Paid", tone: "success" },
}

export const STATUS = { order: ORDER, listing: LISTING, seller: SELLER, payout: PAYOUT } as const
export type StatusKind = keyof typeof STATUS

export function statusLabel(kind: StatusKind, status: string, audience: Audience): { label: string; tone: Tone } {
  const e = STATUS[kind][status]
  if (!e) return { label: status.replace(/_/g, " "), tone: "neutral" }
  return { label: e[audience], tone: e.tone }
}
