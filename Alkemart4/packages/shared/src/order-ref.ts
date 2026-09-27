/**
 * The one human order reference, e.g. "#B6AA7B".
 *
 * Built from the ORDER GROUP id (what the buyer checked out), so the buyer's
 * order page, their SMS, the seller's order screen and the admin all quote
 * the same number — even when one checkout is split across several sellers.
 */
export function orderReference(orderGroupId: string | null | undefined): string {
  const raw = (orderGroupId ?? "").trim()
  if (!raw) return "#······"
  return `#${raw.replace(/^(order_|og_)/i, "").slice(-6).toUpperCase()}`
}
