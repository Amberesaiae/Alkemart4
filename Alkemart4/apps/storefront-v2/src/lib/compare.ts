import { apiJson } from "./http"
import { getWorkersAccessToken } from "./auth"
import { getActiveMarket } from "./market"

/** ⚖ Compare mode — mirrors apps/api/src/routes/store/compare.ts. */
export type CompareTokens = { balance: number; grant: number; nextRefillAt: string; maxItems: number }

export type CompareColumn = {
  productId: string
  slug: string | null
  title: string
  imageUrl: string | null
  brand: string | null
  model: string | null
  ratingAvg: number | null
  ratingCount: number
  shops: number
  inStock: boolean
  best: {
    offerId: string
    sellerName: string
    sellerHandle: string
    pricePesewas: string
    deliveryFeePesewas: string
    totalPesewas: string
    currency: string
    condition: string | null
    warranty: string | null
    deliveryPromise: string | null
  } | null
  returnsDays: number | null
  attributes: { label: string; value: string }[]
}

export type Comparison = { id: string; createdAt: string; columns: CompareColumn[]; missing: number; tokens: CompareTokens }

const opts = (init?: RequestInit) => ({ ...init, token: getWorkersAccessToken() })

export const getCompareTokens = () => apiJson<CompareTokens>("/store/compare/tokens", opts())
export const openComparison = (productIds: string[]) =>
  apiJson<{ id: string; tokens: CompareTokens }>("/store/compare", opts({ method: "POST", body: JSON.stringify({ productIds }) }))
export const getComparison = (id: string) => apiJson<Comparison>(`/store/compare/${encodeURIComponent(id)}`, opts())

/** Minor units (as the API sends them) → major, for formatMoney. */
export const minorToMajor = (minor: string) => Number(minor) / getActiveMarket().currency.minorUnitsPerMajor
