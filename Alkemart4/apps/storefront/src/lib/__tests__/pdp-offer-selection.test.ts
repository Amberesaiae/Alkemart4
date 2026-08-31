import { describe, expect, it } from "vitest"

/**
 * Pure selection rule mirrored from product.$id.tsx:
 * with 2+ peer offers, ATC requires an explicit selectedOfferId.
 */
function resolveActiveOfferId(opts: {
  peerCount: number
  selectedOfferId: string | null
  productOfferId: string | null
  firstPeerOfferId: string | null
}): string | null {
  const requiresOfferPick = opts.peerCount > 1
  if (requiresOfferPick) return opts.selectedOfferId
  return (
    opts.selectedOfferId ||
    opts.productOfferId ||
    opts.firstPeerOfferId ||
    null
  )
}

describe("PDP offer selection (multivendor)", () => {
  it("does not auto-ATC when two peer offers and nothing selected", () => {
    const active = resolveActiveOfferId({
      peerCount: 2,
      selectedOfferId: null,
      productOfferId: "offer-a",
      firstPeerOfferId: "offer-a",
    })
    expect(active).toBeNull()
  })

  it("uses selected offer when multiple peers", () => {
    const active = resolveActiveOfferId({
      peerCount: 2,
      selectedOfferId: "offer-b",
      productOfferId: "offer-a",
      firstPeerOfferId: "offer-a",
    })
    expect(active).toBe("offer-b")
  })

  it("falls back to product offer when a single peer", () => {
    const active = resolveActiveOfferId({
      peerCount: 1,
      selectedOfferId: null,
      productOfferId: "offer-a",
      firstPeerOfferId: "offer-a",
    })
    expect(active).toBe("offer-a")
  })
})
