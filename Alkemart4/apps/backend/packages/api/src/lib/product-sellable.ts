/**
 * Simplified sellable predicate — product is discoverable if it's published,
 * the seller is open, and it has at least one offer.
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
  seller_status?: string | null
  has_ghs_offer?: boolean
  in_stock?: boolean
}

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
      id: "seller_open",
      ok: sellerStatus === "open",
      detail: sellerStatus || "missing",
    },
    {
      id: "ghs_offer",
      ok: Boolean(input.has_ghs_offer),
    },
    {
      id: "in_stock",
      ok: inStock,
    },
  ]

  const sellable = clauses.every((c) => c.ok)

  return { sellable, in_stock: inStock, clauses }
}
