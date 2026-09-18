/**
 * Card rating display rule.
 *
 * A product with no published reviews shows no rating at all — not a zero,
 * not a greyed-out star row. An unearned score is worse than a missing one:
 * it teaches buyers to discount every score on the page, including the real
 * ones. Same rule the store cards will use for seller ratings.
 */
export type CardRating = {
  /** One decimal place, e.g. "4.6" — never rounded up to a whole star. */
  value: string
  count: number
  label: string
}

export function cardRating(
  ratingAvg?: number | null,
  ratingCount?: number | null,
): CardRating | null {
  const count = ratingCount ?? 0
  if (ratingAvg == null || !Number.isFinite(ratingAvg)) return null
  if (count <= 0) return null
  if (ratingAvg <= 0) return null
  const value = ratingAvg.toFixed(1)
  return {
    value,
    count,
    label: `Rated ${value} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}`,
  }
}
