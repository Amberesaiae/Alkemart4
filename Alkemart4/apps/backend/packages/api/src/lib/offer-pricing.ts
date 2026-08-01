/**
 * Pure, testable mapping: vendor variant "edit price" form
 * -> Mercur `updateOffersWorkflow` input.
 *
 * First principles:
 *  - offers are keyed by the VARIANT they cover, but updateOffersWorkflow keys
 *    by OFFER id and mutates PRICE rows. We therefore resolve
 *    variant_id -> offer_id -> price row here (no DB writes in this module).
 *  - currency is fixed to GHS (matches quick-list / approve encoding, which
 *    stores amount in MAJOR units — verified via storefront formatMoney).
 *  - an edit for a variant the seller doesn't own an offer for is surfaced as
 *    `unmatched` (caller decides 403 vs ignore); never throws away the mismatch.
 */

export type VariantPriceEdit = {
  id: string // product_variant.id
  price_ghs?: number | string | null
}

export type OfferRow = {
  id: string
  variant_id: string
  prices?: Array<{ id?: string; amount: number; currency_code: string }>
}

export type OfferPriceUpdate = {
  id: string
  prices: Array<{ id?: string; amount: number; currency_code: string }>
}

export function normalizePriceGhs(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n
}

export function buildOfferPriceUpdates(
  edits: VariantPriceEdit[],
  offerRows: OfferRow[],
  currency = "ghs",
): { updates: OfferPriceUpdate[]; unmatched: string[]; invalid: string[] } {
  const byVariant = new Map<string, OfferRow>()
  for (const o of offerRows) {
    if (o.variant_id && !byVariant.has(o.variant_id)) byVariant.set(o.variant_id, o)
  }

  const updates: OfferPriceUpdate[] = []
  const unmatched: string[] = []
  const invalid: string[] = []

  for (const e of edits) {
    if (!e.id) continue
    const price = normalizePriceGhs(e.price_ghs)
    if (price === null) {
      // no price edit for this variant -> skip silently
      continue
    }
    if (price < 0.5) {
      invalid.push(e.id)
      continue
    }
    const offer = byVariant.get(e.id)
    if (!offer) {
      unmatched.push(e.id)
      continue
    }
    const existing = (offer.prices ?? []).find(
      (p) => (p.currency_code || "").toLowerCase() === currency.toLowerCase(),
    )
    if (existing && existing.id) {
      updates.push({ id: offer.id, prices: [{ id: existing.id, amount: price, currency_code: currency }] })
    } else {
      // upsert a new GHS price row on an offer the seller owns
      updates.push({ id: offer.id, prices: [{ amount: price, currency_code: currency }] })
    }
  }

  return { updates, unmatched, invalid }
}
