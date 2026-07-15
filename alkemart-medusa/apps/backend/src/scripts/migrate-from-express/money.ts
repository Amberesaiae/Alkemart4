/**
 * Money conversion: Express integer pesewas → Medusa GHS major units.
 *
 * Express stores catalog prices as integer pesewas (`price_pesewas`), e.g. 189900.
 * Medusa v2.17 Store API `calculated_price.calculated_amount` is in **major**
 * currency units (GHS), e.g. 1899.00 — verified in seed-ghana (USE_PESEWAS=false).
 *
 *   pesewas / 100  →  medusa_amount_ghs  (may be float, e.g. 12.5)
 *   medusa_amount_ghs * 100  →  pesewas (at app boundary)
 *
 * Prefer integer math for reverse conversion when needed:
 *   Math.round(amountMajor * 100)
 */

/** Express pesewas (integer) → Medusa price amount in GHS major units. */
export function pesewasToMedusaAmount(pricePesewas: number): number {
  if (!Number.isFinite(pricePesewas)) {
    throw new Error(`Invalid pricePesewas: ${pricePesewas}`)
  }
  // Integer pesewas → major; allow fractional GHS (e.g. 50 pesewas → 0.5)
  return pricePesewas / 100
}

/** Medusa major GHS → Express pesewas (integer, rounded). */
export function medusaAmountToPesewas(amountMajor: number): number {
  if (!Number.isFinite(amountMajor)) {
    throw new Error(`Invalid amountMajor: ${amountMajor}`)
  }
  return Math.round(amountMajor * 100)
}
