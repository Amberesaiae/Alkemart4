/**
 * Derived sellable predicate — buyer can add to cart / discover via search.
 * sellable ≠ published (ADR KD-8, KD-15).
 */

export type SellableClause = {
  id: string
  ok: boolean
  detail?: string
}

export type SellableEvaluation = {
  sellable: boolean
  in_stock: boolean
  clauses: SellableClause[]
}

export type SellableInput = {
  product_status?: string | null
  /** Linked to at least one seller via product_seller */
  has_product_seller?: boolean
  seller_status?: string | null
  seller_setup_complete?: boolean
  /** Linked to storefront sales channel */
  has_sales_channel?: boolean
  /** At least one GHS offer */
  has_ghs_offer?: boolean
  /** Offer has shipping_profile_id */
  has_shipping_profile?: boolean
  /** stocked_quantity > 0 or unlimited */
  in_stock?: boolean
}

/**
 * Hard rules for v1 discovery (search + sitemap).
 * Store product list may still show published non-sellable (accepted divergence).
 */
export function evaluateSellable(input: SellableInput): SellableEvaluation {
  const status = (input.product_status || "").toLowerCase()
  const sellerStatus = (input.seller_status || "").toLowerCase()
  const inStock = Boolean(input.in_stock)

  const clauses: SellableClause[] = [
    {
      id: "published",
      ok: status === "published",
      detail: status || "missing",
    },
    {
      id: "product_seller",
      ok: Boolean(input.has_product_seller),
    },
    {
      id: "seller_open",
      ok: sellerStatus === "open",
      detail: sellerStatus || "missing",
    },
    {
      id: "seller_setup",
      ok: input.seller_setup_complete !== false,
      detail:
        input.seller_setup_complete === false
          ? "setup_incomplete"
          : "ok_or_unknown",
    },
    {
      id: "sales_channel",
      ok: Boolean(input.has_sales_channel),
    },
    {
      id: "ghs_offer",
      ok: Boolean(input.has_ghs_offer),
    },
    {
      id: "shipping_profile",
      ok: Boolean(input.has_shipping_profile),
    },
    {
      id: "in_stock",
      ok: inStock,
    },
  ]

  // seller_setup: if unknown (undefined), do not hard-fail discovery when other clauses pass
  // — reindex path should pass explicit boolean when available
  const sellable = clauses.every((c) => {
    if (c.id === "seller_setup" && input.seller_setup_complete === undefined) {
      return true
    }
    return c.ok
  })

  return { sellable, in_stock: inStock, clauses }
}
