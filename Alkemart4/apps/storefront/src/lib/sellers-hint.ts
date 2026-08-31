/** Multivendor PLP hint — only when more than one sellable offer. */
export function sellersHintText(offerCount?: number | null): string | null {
  if (offerCount == null || offerCount <= 1) return null
  return `${offerCount} sellers`
}
