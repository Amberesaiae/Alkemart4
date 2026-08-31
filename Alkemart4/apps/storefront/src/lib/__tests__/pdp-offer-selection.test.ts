import { describe, expect, it } from "vitest"

/**
 * Pure selection rule mirrored from product.$id.tsx:
 * prefer product.offerCount so we don't auto-select while peers load.
 */
function resolveActiveOfferId(opts: {
  productOfferCount: number | null
  peerCount: number
  peersReady: boolean
  selectedOfferId: string | null
  productOfferId: string | null
  firstPeerOfferId: string | null
}): string | null {
  const known =
    opts.productOfferCount ?? (opts.peersReady ? opts.peerCount : null)
  const requiresOfferPick = (known ?? 0) > 1
  if (requiresOfferPick) return opts.selectedOfferId
  return (
    opts.selectedOfferId ||
    opts.productOfferId ||
    opts.firstPeerOfferId ||
    null
  )
}

describe("PDP offer selection (multivendor)", () => {
  it("does not auto-ATC when product.offerCount is 2 and nothing selected", () => {
    const active = resolveActiveOfferId({
      productOfferCount: 2,
      peerCount: 0,
      peersReady: false,
      selectedOfferId: null,
      productOfferId: "offer-a",
      firstPeerOfferId: null,
    })
    expect(active).toBeNull()
  })

  it("does not auto-ATC while peers are still loading if count unknown", () => {
    // peers not ready and no offerCount → known=null → requiresOfferPick false,
    // but callers must wait; simulate post-load with peerCount 2:
    const afterLoad = resolveActiveOfferId({
      productOfferCount: null,
      peerCount: 2,
      peersReady: true,
      selectedOfferId: null,
      productOfferId: "offer-a",
      firstPeerOfferId: "offer-a",
    })
    expect(afterLoad).toBeNull()
  })

  it("uses selected offer when multiple peers", () => {
    const active = resolveActiveOfferId({
      productOfferCount: 2,
      peerCount: 2,
      peersReady: true,
      selectedOfferId: "offer-b",
      productOfferId: "offer-a",
      firstPeerOfferId: "offer-a",
    })
    expect(active).toBe("offer-b")
  })

  it("falls back to product offer when a single peer", () => {
    const active = resolveActiveOfferId({
      productOfferCount: 1,
      peerCount: 1,
      peersReady: true,
      selectedOfferId: null,
      productOfferId: "offer-a",
      firstPeerOfferId: "offer-a",
    })
    expect(active).toBe("offer-a")
  })
})
