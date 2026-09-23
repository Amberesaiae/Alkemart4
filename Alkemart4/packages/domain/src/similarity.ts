/**
 * Blueprint Phase 8A — attribute-aware alternatives (pure, test-pinned).
 * Similarity rides product type + typed attributes (Phase 1), never
 * promoted into the peer-offer table: alternatives are "related", and the
 * comparison table stays variant-exact. Success is measured downstream by
 * `alternative_selected` → delivered order, not by clicks alone.
 */

export type SimilarProductInput = {
  productId: string
  primaryCategoryId: string
  productType: string | null
  brand: string | null
  pricePesewas: bigint | null
  /** definitionId → normalized value signature. */
  attributes: Map<string, string>
}

export function attributeSignature(
  defType: string,
  row: {
    textValue?: string | null
    numberValue?: number | null
    booleanValue?: boolean | null
    optionValues?: string[] | null
  },
): string {
  switch (defType) {
    case "number":
      return row.numberValue != null ? `n:${row.numberValue}` : "n:?"
    case "boolean":
      return row.booleanValue != null ? `b:${row.booleanValue}` : "b:?"
    case "option":
    case "multi_option":
      return `o:${[...(row.optionValues ?? [])].sort().join("|").toLowerCase()}`
    default:
      return `t:${(row.textValue ?? "").trim().toLowerCase()}`
  }
}

export function scoreSimilarity(
  source: SimilarProductInput,
  candidate: SimilarProductInput,
): { score: number; reasons: string[] } {
  if (source.productId === candidate.productId) return { score: -1, reasons: ["self"] }
  let score = 0
  const reasons: string[] = []
  if (
    source.primaryCategoryId &&
    source.primaryCategoryId === candidate.primaryCategoryId
  ) {
    score += 3
    reasons.push("same category")
  }
  if (source.productType && candidate.productType === source.productType) {
    score += 2
    reasons.push("same product type")
  }
  if (source.brand && candidate.brand === source.brand) {
    score += 1
    reasons.push("same brand")
  }
  let shared = 0
  for (const [defId, sig] of source.attributes) {
    if (sig && candidate.attributes.get(defId) === sig) shared += 1
  }
  const sharedCapped = Math.min(3, shared)
  score += sharedCapped
  if (sharedCapped > 0) reasons.push(`${sharedCapped} shared attributes`)
  if (source.pricePesewas != null && source.pricePesewas > 0n && candidate.pricePesewas != null) {
    const diff =
      source.pricePesewas > candidate.pricePesewas
        ? source.pricePesewas - candidate.pricePesewas
        : candidate.pricePesewas - source.pricePesewas
    if (diff * 5n <= source.pricePesewas) {
      score += 1
      reasons.push("nearby price")
    }
  }
  return { score, reasons }
}
