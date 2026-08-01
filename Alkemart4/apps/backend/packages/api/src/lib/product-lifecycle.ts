/**
 * First-principles product-status rules for vendor self-service.
 *
 * Mercur + Medusa lifecycle:
 *   draft -> proposed -> published   (seller creates; admin approves)
 *            proposed -> rejected   (admin rejects)   ; rejected -> proposed (re-propose)
 *            published -> proposed  (seller unpublishes to edit)
 *
 * Invariant: a *published* product is live on the storefront. Mutating its
 * title/description/thumbnail/categories while live can show buyers a
 * half-edited listing. So we require the seller to unpublish first
 * (published -> proposed), edit in the staged state, then re-propose; an
 * auditor/admin re-approves before it returns to published.
 *
 * Stock/price on live variants is intentionally NOT part of this gate — it is
 * treated as a separate, offer/inventory concern (see plan: Phase 1.5).
 */

/** Statuses a seller is allowed to edit directly. */
export const PRODUCT_EDITABLE_STATUSES = new Set([
  "draft",
  "proposed",
  "rejected",
])

/** Only live products can be taken down for editing. */
export function isUnpublishableStatus(status: unknown): boolean {
  return normalizeStatus(status) === "published"
}

export function normalizeStatus(status: unknown): string {
  return String(status ?? "").toLowerCase()
}

export function isEditableStatus(status: unknown): boolean {
  return PRODUCT_EDITABLE_STATUSES.has(normalizeStatus(status))
}

export function isLiveStatus(status: unknown): boolean {
  return normalizeStatus(status) === "published"
}
