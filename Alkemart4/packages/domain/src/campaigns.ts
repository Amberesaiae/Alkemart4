/**
 * Blueprint Phase 5A — campaign eligibility and placement resolution.
 * Pure functions: the store owns persistence, the route owns auditing, and
 * this module owns the rules so tests pin them without I/O.
 */

export type CampaignProductInput = {
  productId: string
  pricePesewas: bigint
  hasImage: boolean
  onHand: number
  reserved: number
  productStatus: string
  sellerStatus: string
  offerActive: boolean
}

/**
 * A product may ride a campaign only when a buyer clicking through lands
 * on something real: published, open seller, live offer, stock, price,
 * and an image. Reasons name every failure — the studio shows them
 * instead of silently dropping products.
 */
export function evaluateCampaignEligibility(input: CampaignProductInput): {
  eligible: boolean
  reasons: string[]
} {
  const reasons: string[] = []
  if (input.productStatus !== "published") reasons.push("product unpublished")
  if (input.sellerStatus !== "open") reasons.push("seller not open")
  if (!input.offerActive) reasons.push("offer inactive")
  if (input.onHand - input.reserved <= 0) reasons.push("out of stock")
  if (input.pricePesewas <= 0n) reasons.push("no price")
  if (!input.hasImage) reasons.push("no image")
  return { eligible: reasons.length === 0, reasons }
}

export type CampaignCandidate = {
  id: string
  placementCode: string
  status: string
  priority: number
  startsAt: Date | null
  endsAt: Date | null
  createdAt: Date
}

function isLiveWindow(c: CampaignCandidate, now: Date): boolean {
  if (c.status !== "live" && c.status !== "scheduled") return false
  if (c.status === "scheduled") return false
  if (c.startsAt && c.startsAt.getTime() > now.getTime()) return false
  if (c.endsAt && c.endsAt.getTime() <= now.getTime()) return false
  return true
}

export function isCampaignExpired(status: string, endsAt: Date | null, now: Date): boolean {
  if (endsAt == null) return false
  if (endsAt.getTime() > now.getTime()) return false
  return status === "live" || status === "scheduled"
}

/**
 * Deterministic winner per placement: highest priority wins; ties break
 * by earliest start, then earliest creation, then id. Everything else is
 * suppressed with a reason — never silently replaced, never rotated.
 */
export function resolvePlacement(
  placementCode: string,
  candidates: CampaignCandidate[],
  now: Date,
): { winner: CampaignCandidate | null; suppressed: { id: string; reason: string }[] } {
  const live = candidates.filter((c) => c.placementCode === placementCode && isLiveWindow(c, now))
  const ordered = [...live].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    const aStart = a.startsAt ? a.startsAt.getTime() : Number.POSITIVE_INFINITY
    const bStart = b.startsAt ? b.startsAt.getTime() : Number.POSITIVE_INFINITY
    if (aStart !== bStart) return aStart - bStart
    if (a.createdAt.getTime() !== b.createdAt.getTime()) {
      return a.createdAt.getTime() - b.createdAt.getTime()
    }
    return a.id.localeCompare(b.id)
  })
  const [winner = null] = ordered
  return {
    winner,
    suppressed: ordered.slice(1).map((c) => ({
      id: c.id,
      reason: winner ? `outranked by ${winner.id} (priority ${winner.priority})` : "no live campaign",
    })),
  }
}

/**
 * One campaign cannot dominate adjacent placements: when the same campaign
 * wins several slots, it keeps the earliest slot and yields the rest to
 * their runners-up (which may be empty — an empty slot renders nothing).
 */
export function dedupePlacementWinners(
  wins: { placementCode: string; winner: CampaignCandidate | null; suppressed: { id: string; reason: string }[] }[],
): { placementCode: string; winner: CampaignCandidate | null; suppressed: { id: string; reason: string }[] }[] {
  const seen = new Set<string>()
  return wins.map((w) => {
    if (!w.winner || seen.has(w.winner.id)) {
      if (w.winner && seen.has(w.winner.id)) {
        return {
          placementCode: w.placementCode,
          winner: null,
          suppressed: [
            ...w.suppressed,
            { id: w.winner.id, reason: `yielded ${w.placementCode}: already wins an earlier slot` },
          ],
        }
      }
      return w
    }
    seen.add(w.winner.id)
    return w
  })
}
