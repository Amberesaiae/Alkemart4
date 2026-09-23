import { describe, expect, it } from "vitest"
import {
  dedupePlacementWinners,
  evaluateCampaignEligibility,
  isCampaignExpired,
  resolvePlacement,
  type CampaignCandidate,
} from "../campaigns"

const NOW = new Date("2026-09-21T12:00:00.000Z")

function candidate(over: Partial<CampaignCandidate> & { id: string }): CampaignCandidate {
  return {
    placementCode: "hero",
    status: "live",
    priority: 0,
    startsAt: new Date("2026-09-20T00:00:00.000Z"),
    endsAt: null,
    createdAt: new Date("2026-09-19T00:00:00.000Z"),
    ...over,
  }
}

describe("evaluateCampaignEligibility (Phase 5A)", () => {
  const good = {
    productId: "p1",
    pricePesewas: 10000n,
    hasImage: true,
    onHand: 5,
    reserved: 0,
    productStatus: "published",
    sellerStatus: "open",
    offerActive: true,
  }
  it("passes a healthy offer with no reasons", () => {
    expect(evaluateCampaignEligibility(good)).toEqual({ eligible: true, reasons: [] })
  })
  it("names every failure instead of silently dropping", () => {
    const bad = evaluateCampaignEligibility({
      ...good,
      productStatus: "proposed",
      sellerStatus: "suspended",
      offerActive: false,
      onHand: 0,
      pricePesewas: 0n,
      hasImage: false,
    })
    expect(bad.eligible).toBe(false)
    expect(bad.reasons).toEqual([
      "product unpublished",
      "seller not open",
      "offer inactive",
      "out of stock",
      "no price",
      "no image",
    ])
  })
})

describe("resolvePlacement (Phase 5A)", () => {
  it("picks highest priority; ties break by start, creation, id", () => {
    const a = candidate({ id: "a", priority: 1 })
    const b = candidate({ id: "b", priority: 5 })
    const c = candidate({ id: "c", priority: 5, startsAt: new Date("2026-09-21T00:00:00.000Z") })
    const { winner, suppressed } = resolvePlacement("hero", [a, b, c], NOW)
    expect(winner?.id).toBe("b")
    expect(suppressed.map((s) => s.id)).toEqual(["c", "a"])
  })
  it("excludes scheduled, future, and expired campaigns", () => {
    const scheduled = candidate({ id: "s", status: "scheduled" })
    const future = candidate({ id: "f", startsAt: new Date("2026-09-22T00:00:00.000Z") })
    const expired = candidate({ id: "e", endsAt: new Date("2026-09-20T00:00:00.000Z") })
    const live = candidate({ id: "l" })
    const { winner } = resolvePlacement("hero", [scheduled, future, expired, live], NOW)
    expect(winner?.id).toBe("l")
    expect(isCampaignExpired("live", expired.endsAt, NOW)).toBe(true)
    expect(isCampaignExpired("live", null, NOW)).toBe(false)
  })
})

describe("dedupePlacementWinners (Phase 5C)", () => {
  it("lets one campaign keep its earliest slot only", () => {
    const w = candidate({ id: "w", placementCode: "hero" })
    const wins = [
      { placementCode: "hero", winner: w, suppressed: [] as { id: string; reason: string }[] },
      { placementCode: "deal_rail", winner: { ...w, placementCode: "deal_rail" }, suppressed: [] as { id: string; reason: string }[] },
    ]
    const out = dedupePlacementWinners(wins)
    expect(out[0]!.winner?.id).toBe("w")
    expect(out[1]!.winner).toBeNull()
    expect(out[1]!.suppressed[0]!.reason).toMatch(/already wins an earlier slot/)
  })
})
