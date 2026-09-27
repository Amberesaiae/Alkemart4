import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getPeerComparison, type PeerSort, type StoreProductCard } from "@/lib/products"
import {
  cheapestBuyableSelection,
  resolveOfferSelection,
  type ComboSelection,
} from "@/lib/offer-selection"
import { trackOfferSelected, trackVariantSelected } from "@/lib/analytics"

/**
 * Live offer selection for one product: loads the peer comparison, keeps the
 * buyer's option + seller picks, and resolves them through the shared pure
 * rules in lib/offer-selection.
 */
export function useOfferSelection(
  product: StoreProductCard | undefined,
  sort: PeerSort = "total",
  /** Seller to preselect once peers load (deep link `?offer=`). */
  initialOfferId?: string | null,
) {
  const [comboSel, setComboSel] = useState<ComboSelection>({})
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [preselected, setPreselected] = useState(false)
  const [forProduct, setForProduct] = useState(product?.id)

  const eligible = Boolean(product?.id) && product?.identity?.comparisonEligible !== false
  const peersQ = useQuery({
    queryKey: ["store", "peer-offers", product?.id, sort],
    queryFn: () => getPeerComparison(product!.id, { sort }),
    enabled: eligible,
    // Keep the list on screen while re-sorting — never another product's offers.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[2] === product?.id ? prev : undefined),
  })
  // The server can decline comparison (identity not reviewed yet) — then, like
  // Level C listings, the card's own offer is the only one. Without this the
  // page waited for peers that never come and nothing could be bought.
  const compared = eligible && peersQ.data?.comparisonEligible !== false
  const peers = useMemo(() => {
    if (compared) return peersQ.data?.offers ?? []
    if (!product?.offerId || !product.seller?.name) return []
    return [
      {
        offerId: product.offerId,
        amount: product.amount ?? null,
        currencyCode: product.currencyCode ?? null,
        seller: product.seller,
      },
    ]
  }, [compared, peersQ.data, product])
  const peersReady = !eligible || peersQ.isSuccess || peersQ.isError

  // New product → fresh picks (adjusted during render, not in an effect).
  if (product?.id !== forProduct) {
    setForProduct(product?.id)
    setComboSel({})
    setSelectedOfferId(null)
    setPreselected(false)
  }
  // Once peers resolve: anchor the lowest real price for variant products and
  // honour a deep-linked seller. Silent — not a buyer action.
  if (product && product.id === forProduct && !preselected && peersReady) {
    setPreselected(true)
    if (product.optionTypes?.length) setComboSel(cheapestBuyableSelection(product, peers))
    if (initialOfferId && peers.some((o) => o.offerId === initialOfferId)) setSelectedOfferId(initialOfferId)
  }

  const selection = useMemo(
    () =>
      product
        ? resolveOfferSelection({ product, peers, peersReady, comboSel, selectedOfferId })
        : null,
    [product, peers, peersReady, comboSel, selectedOfferId],
  )

  return {
    selection,
    peers,
    peersQ,
    comboSel,
    selectOption(name: string, value: string) {
      const next = { ...comboSel, [name]: value }
      setComboSel(next)
      // A seller picked for another combination must not carry over.
      setSelectedOfferId(null)
      if (product) {
        trackVariantSelected({
          productId: product.id,
          options: Object.entries(next).map(([k, v]) => `${k}=${v}`).join(" · "),
        })
      }
    },
    selectOffer(offerId: string) {
      setSelectedOfferId(offerId)
      if (product) {
        const o = peers.find((p) => p.offerId === offerId)
        trackOfferSelected({ productId: product.id, offerId, sellerId: o?.seller.id ?? null })
      }
    },
  }
}
