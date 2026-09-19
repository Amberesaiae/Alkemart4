/**
 * Card rating display rule: hide when count is 0. Never invent stars.
 */
export type CardRating = {
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

export function formatRating(avg: number, count: number): string | null {
  const card = cardRating(avg, count)
  if (!card) return null
  return `${card.value} (${card.count})`
}
