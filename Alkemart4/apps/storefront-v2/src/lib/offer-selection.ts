/**
 * Offer selection — the single rule set for "which offer does Add to cart
 * bind?" Shared by the PDP and the quick-buy sheet so the two can never
 * disagree. Pure: no React, no I/O.
 *
 * Rules (ATC binds an offerId; Product ≠ Offer):
 * 1. Variant matrix products resolve a complete option combination first;
 *    only combos that are active, stocked and present in the peer list are
 *    buyable.
 * 2. When more than one seller offers the resolved item, the buyer must pick
 *    a seller — nothing is auto-picked.
 * 3. With exactly one candidate offer, it is selected implicitly.
 */
import type { PeerOffer, StoreProductCard } from "./products"

export type Combo = NonNullable<StoreProductCard["combos"]>[number]
export type ComboSelection = Record<string, string>

export type OfferSelectionInput = {
  product: Pick<StoreProductCard, "offerId" | "offerCount" | "optionTypes" | "combos" | "amount" | "currencyCode" | "seller">
  peers: PeerOffer[]
  /** Peer list has resolved (success or error). */
  peersReady: boolean
  comboSel: ComboSelection
  selectedOfferId: string | null
}

export type OptionValueState = {
  value: string
  imageUrl: string | null
  selected: boolean
  /** Some combo with this value exists given the other picks. */
  exists: boolean
  /** That combo is buyable right now. */
  buyable: boolean
}

export type OfferSelection = {
  hasMatrix: boolean
  comboComplete: boolean
  /** Per option type, the state of each value for the chip UI. */
  options: { name: string; selectedValue: string | null; values: OptionValueState[] }[]
  /** Offers the buyer can choose between for the current selection. */
  candidates: PeerOffer[]
  requiresOfferPick: boolean
  /** Lowest total (item + delivery) among candidates; the neutral default. */
  bestOfferId: string | null
  /** True when the active offer is the default, not the buyer's own pick. */
  autoPicked: boolean
  activeOfferId: string | null
  activeOffer: PeerOffer | null
  displayAmount: number | null
  displayCurrency: string | null
  displaySeller: PeerOffer["seller"] | StoreProductCard["seller"] | null
  /** Why buying is blocked, in buyer words; null when it is not. */
  blockedReason: string | null
  canBuy: boolean
  /** The combination is resolved but nobody has stock — show "notify me". */
  outOfStock: boolean
}

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export function comboMatches(combo: Pick<Combo, "options">, sel: ComboSelection): boolean {
  return Object.entries(sel).every(([k, v]) => eq(combo.options[k] ?? "", v))
}

function isBuyable(c: Combo, peerIds: Set<string>): boolean {
  return c.active && c.availableQty > 0 && peerIds.has(c.offerId)
}

/**
 * The selection to preselect once peers resolve: the cheapest buyable combo,
 * which anchors the lowest real price. Empty when nothing is buyable.
 */
export function cheapestBuyableSelection(
  product: OfferSelectionInput["product"],
  peers: PeerOffer[],
): ComboSelection {
  const peerIds = new Set(peers.map((o) => o.offerId))
  const best = (product.combos ?? [])
    .filter((c) => isBuyable(c, peerIds) && c.amount != null)
    .sort((a, b) => (a.amount as number) - (b.amount as number))[0]
  if (!best) return {}
  const sel: ComboSelection = {}
  for (const t of product.optionTypes ?? []) {
    const v = best.options[t.name]
    if (v) sel[t.name] = v
  }
  return sel
}

export function resolveOfferSelection(input: OfferSelectionInput): OfferSelection {
  const { product, peers, peersReady, comboSel, selectedOfferId } = input
  const optionTypes = product.optionTypes ?? []
  const combos = product.combos ?? []
  const hasMatrix = optionTypes.length > 0
  const peerIds = new Set(peers.map((o) => o.offerId))

  const comboComplete =
    !hasMatrix ||
    optionTypes.every((t) => {
      const picked = comboSel[t.name]
      return Boolean(picked) && t.values.some((v) => eq(v.value, picked!))
    })
  const matching = combos.filter((c) => comboMatches(c, comboSel))
  const matchingBuyableIds = new Set(
    matching.filter((c) => isBuyable(c, peerIds)).map((c) => c.offerId),
  )

  const options = optionTypes.map((t) => ({
    name: t.name,
    selectedValue: comboSel[t.name] ?? null,
    values: t.values.map((vo) => {
      const chosen = { ...comboSel, [t.name]: vo.value }
      const hits = combos.filter((c) => comboMatches(c, chosen))
      return {
        value: vo.value,
        imageUrl: vo.imageUrl,
        selected: eq(comboSel[t.name] ?? "", vo.value),
        exists: hits.length > 0,
        buyable: hits.some((c) => isBuyable(c, peerIds)),
      }
    }),
  }))

  const candidates = hasMatrix
    ? comboComplete
      ? peers.filter((o) => matchingBuyableIds.has(o.offerId))
      : []
    : peers

  // Prefer the product's own count so nothing auto-selects while peers load.
  const knownOfferCount = hasMatrix
    ? candidates.length
    : peersReady
      ? peers.length
      : (product.offerCount ?? null)
  /** Several sellers to choose between (the buyer can switch). */
  const requiresOfferPick = (knownOfferCount ?? 0) > 1

  // The neutral default: the lowest total the buyer pays (price + delivery).
  // Stated on the page as "Best price" — never a hidden favourite.
  const totalOf = (o: PeerOffer) => (o.amount == null ? Infinity : o.amount + (o.deliveryAmount ?? 0))
  const bestOfferId = candidates.reduce<PeerOffer | null>((best, o) => (best == null || totalOf(o) < totalOf(best) ? o : best), null)?.offerId ?? null

  const validPick =
    selectedOfferId && candidates.some((o) => o.offerId === selectedOfferId)
      ? selectedOfferId
      : null
  let activeOfferId: string | null
  if (!peersReady && (product.offerCount ?? 0) > 1) activeOfferId = null // don't guess before we can compare
  else if (hasMatrix) activeOfferId = validPick ?? (candidates.length > 1 ? bestOfferId : (candidates[0]?.offerId ?? null))
  else if (candidates.length > 1) activeOfferId = validPick ?? bestOfferId
  else if (!peersReady && product.offerCount == null) activeOfferId = null
  else activeOfferId = validPick ?? candidates[0]?.offerId ?? product.offerId ?? null
  const autoPicked = activeOfferId != null && validPick == null && candidates.length > 1

  const activeOffer = peers.find((o) => o.offerId === activeOfferId) ?? null

  // Price: the chosen offer's, else the cheapest for the combo, else the card's.
  const comboLow = hasMatrix && comboComplete
    ? matching.reduce<number | null>(
        (best, c) => (c.amount != null && (best == null || c.amount < best) ? c.amount : best),
        null,
      )
    : null
  const displayAmount = activeOffer?.amount ?? comboLow ?? product.amount ?? null
  const displayCurrency = activeOffer?.currencyCode ?? product.currencyCode ?? null
  const displaySeller = activeOffer?.seller ?? (activeOfferId ? (product.seller ?? null) : null)

  const noStockAnywhere = peersReady && !hasMatrix && (knownOfferCount ?? 0) === 0
  const outOfStock = hasMatrix ? comboComplete && matchingBuyableIds.size === 0 : noStockAnywhere

  let blockedReason: string | null = null
  if (hasMatrix && !comboComplete) {
    blockedReason = `Choose ${optionTypes.find((t) => !comboSel[t.name])?.name.toLowerCase() ?? "options"}`
  } else if (hasMatrix && matchingBuyableIds.size === 0) {
    blockedReason =
      matching.length > 0 && matching.every((c) => !c.active)
        ? "This combination is no longer available"
        : "This combination is out of stock"
  } else if (noStockAnywhere) {
    blockedReason = "Out of stock"
  } else if (requiresOfferPick && !activeOfferId) {
    blockedReason = "Choose a seller"
  } else if (!activeOfferId) {
    blockedReason = peersReady ? "Not available to buy yet" : null
  }

  return {
    hasMatrix,
    comboComplete,
    options,
    candidates,
    requiresOfferPick,
    bestOfferId,
    autoPicked,
    activeOfferId,
    activeOffer,
    displayAmount,
    displayCurrency,
    displaySeller,
    blockedReason,
    canBuy: Boolean(activeOfferId) && blockedReason == null,
    outOfStock,
  }
}
