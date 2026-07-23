/**
 * Structured reason codes for admin UX.
 * Lifecycle text still goes to Mercur status_reason / product message as `[code] text`.
 */

export const SELLER_REASON_CODES = [
  {
    code: "incomplete_profile",
    label: "Incomplete profile",
    defaultText: "Shop profile is incomplete or unclear",
  },
  {
    code: "invalid_address",
    label: "Invalid address",
    defaultText: "Ghana business address needs correction",
  },
  {
    code: "policy",
    label: "Policy",
    defaultText: "Does not meet marketplace selling policy",
  },
  {
    code: "duplicate",
    label: "Duplicate shop",
    defaultText: "Appears to duplicate an existing shop",
  },
  {
    code: "other",
    label: "Other",
    defaultText: "See notes",
  },
] as const

export const PRODUCT_REASON_CODES = [
  {
    code: "poor_images",
    label: "Poor images",
    defaultText: "Images are unclear, missing, or not suitable",
  },
  {
    code: "poor_description",
    label: "Poor description",
    defaultText: "Title or description needs more detail",
  },
  {
    code: "wrong_category",
    label: "Wrong category",
    defaultText: "Product category or attributes look incorrect",
  },
  {
    code: "pricing",
    label: "Pricing concern",
    defaultText: "Price looks incorrect for the product",
  },
  {
    code: "policy",
    label: "Policy",
    defaultText: "Does not meet marketplace listing policy",
  },
  {
    code: "other",
    label: "Other",
    defaultText: "See notes",
  },
] as const

export type SellerReasonCode = (typeof SELLER_REASON_CODES)[number]["code"]
export type ProductReasonCode = (typeof PRODUCT_REASON_CODES)[number]["code"]

export function composeMercurReason(
  code: string,
  text?: string | null,
  catalog: readonly { code: string; defaultText: string }[] = SELLER_REASON_CODES,
): string {
  const entry = catalog.find((c) => c.code === code)
  const body = (text && text.trim()) || entry?.defaultText || "See notes"
  return `[${code}] ${body}`
}
