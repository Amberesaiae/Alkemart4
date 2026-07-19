/**
 * Pure helpers for /store/alkemart/catalog product mapping + pagination.
 */

export type CatalogProductRow = {
  id: unknown
  title?: unknown
  handle?: unknown
  thumbnail?: unknown
  description?: unknown
  variants?: unknown
  seller?: unknown
}

export type CatalogCard = {
  id: string
  title: unknown
  handle: unknown
  thumbnail: unknown
  description: unknown
  offer_id: string
  category_label: string | null
  category_handles: string[]
  min_price: number | null
  currency_code: string | null
  seller: {
    id: string | null
    name: string | null
    handle: string | null
  } | null
}

export type CatalogOfferRow = {
  id?: unknown
  product_id?: unknown
  seller_id?: unknown
  prices?: unknown
  product?: {
    id?: unknown
    title?: unknown
    handle?: unknown
    thumbnail?: unknown
    description?: unknown
    status?: unknown
    categories?: unknown
  } | null
  seller?: {
    id?: unknown
    name?: unknown
    handle?: unknown
    status?: unknown
  } | null
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : ""
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Prefer GHS; otherwise lowest amount. Amounts are major currency units. */
export function minPriceFromOfferPrices(prices: unknown): {
  min_price: number | null
  currency_code: string | null
} {
  let minGhs: number | null = null
  let minAny: number | null = null
  let anyCode: string | null = null
  for (const p of asList(prices)) {
    const amount = num(p.amount ?? p.calculated_amount)
    if (amount == null) continue
    const code = str(p.currency_code || p.currencyCode).toLowerCase() || null
    if (code === "ghs") {
      if (minGhs == null || amount < minGhs) minGhs = amount
    }
    if (minAny == null || amount < minAny) {
      minAny = amount
      anyCode = code
    }
  }
  if (minGhs != null) return { min_price: minGhs, currency_code: "ghs" }
  return { min_price: minAny, currency_code: anyCode }
}

export function parseLimitOffset(
  limitRaw: unknown,
  offsetRaw: unknown,
  defaults: { limit?: number; maxLimit?: number } = {},
): { limit: number; offset: number } {
  const defLimit = defaults.limit ?? 24
  const maxLimit = defaults.maxLimit ?? 100
  const limit = Math.min(
    Math.max(
      typeof limitRaw === "string"
        ? Number(limitRaw)
        : typeof limitRaw === "number"
          ? limitRaw
          : defLimit,
      1,
    ),
    maxLimit,
  )
  const offset = Math.max(
    typeof offsetRaw === "string"
      ? Number(offsetRaw)
      : typeof offsetRaw === "number"
        ? offsetRaw
        : 0,
    0,
  )
  return {
    limit: Number.isFinite(limit) ? limit : defLimit,
    offset: Number.isFinite(offset) ? offset : 0,
  }
}

export function paginate<T>(items: T[], offset: number, limit: number): T[] {
  const o = Math.max(0, offset)
  const l = Math.max(1, limit)
  return items.slice(o, o + l)
}

/**
 * Collapse offer rows into one card per product (min GHS price, open sellers only).
 * Pure — no DB. Used after filtered graph loads.
 */
export function accumulateOffersToCards(
  offers: CatalogOfferRow[],
  opts: {
    sellerHandle?: string
    categoryHandle?: string
  } = {},
): CatalogCard[] {
  const sellerHandle = (opts.sellerHandle || "").toLowerCase()
  const categoryHandle = (opts.categoryHandle || "").toLowerCase()

  type Acc = {
    card: CatalogCard
    bestGhs: number | null
    bestAny: number | null
    bestAnyCode: string | null
  }
  const byProduct = new Map<string, Acc>()

  for (const o of offers) {
    const offerId = typeof o.id === "string" ? o.id : ""
    const product = o.product || null
    const productId =
      (typeof product?.id === "string" && product.id) ||
      (typeof o.product_id === "string" ? o.product_id : "")
    if (!offerId || !productId) continue

    const status = String(product?.status || "").toLowerCase()
    if (status && status !== "published") continue

    const sellerRaw = o.seller || null
    const sellerStatus = String(sellerRaw?.status || "open").toLowerCase()
    if (sellerStatus && sellerStatus !== "open") continue

    const sHandle = str(sellerRaw?.handle).toLowerCase()
    if (sellerHandle && sHandle !== sellerHandle) continue

    const cats = asList(product?.categories)
    const category_handles = cats
      .map((c) => str(c.handle).toLowerCase())
      .filter(Boolean)
    const category_names = cats.map((c) => str(c.name)).filter(Boolean)
    if (categoryHandle && !category_handles.includes(categoryHandle)) {
      continue
    }

    const priced = minPriceFromOfferPrices(o.prices)

    let acc = byProduct.get(productId)
    if (!acc) {
      acc = {
        card: {
          id: productId,
          title: product?.title,
          handle: product?.handle,
          thumbnail: product?.thumbnail,
          // PLP: description loaded on PDP only (P1.2)
          description: null,
          offer_id: offerId,
          category_label: category_names[0] ?? null,
          category_handles,
          min_price: priced.min_price,
          currency_code: priced.currency_code,
          seller: sellerRaw
            ? {
                id: (sellerRaw.id as string) ?? null,
                name: (sellerRaw.name as string) ?? null,
                handle: (sellerRaw.handle as string) ?? null,
              }
            : null,
        },
        bestGhs: priced.currency_code === "ghs" ? priced.min_price : null,
        bestAny: priced.min_price,
        bestAnyCode: priced.currency_code,
      }
      byProduct.set(productId, acc)
    } else {
      if (
        priced.currency_code === "ghs" &&
        priced.min_price != null &&
        (acc.bestGhs == null || priced.min_price < acc.bestGhs)
      ) {
        acc.bestGhs = priced.min_price
        acc.card.offer_id = offerId
        if (sellerRaw) {
          acc.card.seller = {
            id: (sellerRaw.id as string) ?? null,
            name: (sellerRaw.name as string) ?? null,
            handle: (sellerRaw.handle as string) ?? null,
          }
        }
      }
      if (
        priced.min_price != null &&
        (acc.bestAny == null || priced.min_price < acc.bestAny)
      ) {
        acc.bestAny = priced.min_price
        acc.bestAnyCode = priced.currency_code
      }
      if (!acc.card.category_label && category_names[0]) {
        acc.card.category_label = category_names[0]
        acc.card.category_handles = category_handles
      }
    }
  }

  return Array.from(byProduct.values()).map((acc) => {
    if (acc.bestGhs != null) {
      acc.card.min_price = acc.bestGhs
      acc.card.currency_code = "ghs"
    } else {
      acc.card.min_price = acc.bestAny
      acc.card.currency_code = acc.bestAnyCode
    }
    return acc.card
  })
}

/**
 * Ordered unique product ids from light offer rows (preserve first-seen order).
 */
export function uniqueProductIdsFromOffers(
  offers: Array<{ product_id?: unknown; product?: { id?: unknown } | null }>,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const o of offers) {
    const id =
      (typeof o.product?.id === "string" && o.product.id) ||
      (typeof o.product_id === "string" ? o.product_id : "")
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function mapPublishedProductWithOffer(
  p: CatalogProductRow,
): CatalogCard | null {
  const id = typeof p.id === "string" ? p.id : ""
  if (!id) return null

  const variants = Array.isArray(p.variants)
    ? (p.variants as { offer_id?: string }[])
    : []
  const offerId =
    variants
      .map((v) => v.offer_id)
      .find((oid) => typeof oid === "string" && oid) || null
  if (!offerId) return null

  const seller = p.seller as
    | { id?: string; name?: string; handle?: string }
    | null
    | undefined

  return {
    id,
    title: p.title,
    handle: p.handle,
    thumbnail: p.thumbnail,
    description: p.description,
    offer_id: offerId,
    category_label: null,
    category_handles: [],
    min_price: null,
    currency_code: null,
    seller: seller
      ? {
          id: seller.id ?? null,
          name: seller.name ?? null,
          handle: seller.handle ?? null,
        }
      : null,
  }
}
