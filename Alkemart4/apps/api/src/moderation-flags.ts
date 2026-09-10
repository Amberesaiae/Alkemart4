/**
 * Rule-based moderation flags (advisory only — a human always decides).
 * Pure functions over catalog snapshots; no I/O, fully unit-testable.
 */

export type ProductFlagRule = "no-image" | "price-outlier" | "banned-words" | "duplicate-title"

export type ProductFlag = { rule: ProductFlagRule; message: string }

export type FlaggableProduct = {
  id: string
  title: string
  description: string | null
  imageUrl?: string | null
  primaryCategoryId: string
  sellerId: string | null
}

export type FlaggableOffer = {
  productId: string
  pricePesewas: bigint
  onHand: number
  active: boolean
}

const BANNED_PHRASES = [
  "rolex",
  "gucci",
  "louis vuitton",
  "whatsapp me",
  "send money",
  "momo pin",
  "free money",
  "replica",
]

function median(values: bigint[]): bigint | null {
  if (values.length < 3) return null
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1]! + sorted[mid]!) / 2n
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Flag one proposed product. `offers` covers the whole catalog (for the
 * category median + duplicate detection), `liveTitles` counts published
 * products per normalized title + seller.
 */
export function flagCatalogProduct(
  product: FlaggableProduct,
  ctx: {
    offersByProduct: Map<string, FlaggableOffer[]>
    medianByCategory: Map<string, bigint>
    liveTitleSellers: Map<string, Set<string>>
  },
): ProductFlag[] {
  const flags: ProductFlag[] = []

  if (!product.imageUrl) {
    flags.push({ rule: "no-image", message: "No product photo" })
  }

  const text = `${product.title} ${product.description ?? ""}`.toLowerCase()
  const hit = BANNED_PHRASES.find((phrase) => text.includes(phrase))
  if (hit) {
    flags.push({ rule: "banned-words", message: `Suspicious phrase: "${hit}"` })
  }

  const prices = (ctx.offersByProduct.get(product.id) ?? [])
    .filter((o) => o.active && o.onHand > 0)
    .map((o) => o.pricePesewas)
  const median = ctx.medianByCategory.get(product.primaryCategoryId) ?? null
  if (prices.length > 0 && median !== null && median > 0n) {
    const min = prices.reduce((a, b) => (a < b ? a : b))
    if (min > median * 3n) {
      flags.push({ rule: "price-outlier", message: "Price far above category median" })
    } else if (min * 5n < median) {
      flags.push({ rule: "price-outlier", message: "Price far below category median" })
    }
  }

  const sellers = ctx.liveTitleSellers.get(normalizeTitle(product.title))
  if (sellers && [...sellers].some((s) => s !== product.sellerId)) {
    flags.push({ rule: "duplicate-title", message: "Same title already live from another seller" })
  }

  return flags
}

/** Build the shared context for a batch of products in one pass. */
export function flaggingContext(
  products: { id: string; title: string; status: string; primaryCategoryId: string; sellerId: string | null }[],
  offers: (FlaggableOffer & { productId: string })[],
): {
  offersByProduct: Map<string, FlaggableOffer[]>
  medianByCategory: Map<string, bigint>
  liveTitleSellers: Map<string, Set<string>>
} {
  const offersByProduct = new Map<string, FlaggableOffer[]>()
  for (const o of offers) {
    const list = offersByProduct.get(o.productId) ?? []
    list.push(o)
    offersByProduct.set(o.productId, list)
  }
  const pricesByCategory = new Map<string, bigint[]>()
  const byId = new Map(products.map((p) => [p.id, p]))
  for (const [productId, list] of offersByProduct) {
    const cat = byId.get(productId)?.primaryCategoryId
    if (!cat) continue
    const bucket = pricesByCategory.get(cat) ?? []
    for (const o of list) {
      if (o.active && o.onHand > 0) bucket.push(o.pricePesewas)
    }
    pricesByCategory.set(cat, bucket)
  }
  const medianByCategory = new Map<string, bigint>()
  for (const [cat, prices] of pricesByCategory) {
    const m = median(prices)
    if (m !== null) medianByCategory.set(cat, m)
  }
  const liveTitleSellers = new Map<string, Set<string>>()
  for (const p of products) {
    if (p.status !== "published" || !p.sellerId) continue
    const key = normalizeTitle(p.title)
    const set = liveTitleSellers.get(key) ?? new Set<string>()
    set.add(p.sellerId)
    liveTitleSellers.set(key, set)
  }
  return { offersByProduct, medianByCategory, liveTitleSellers }
}
