import { useQuery } from "@tanstack/react-query"
import type { StorefrontBadge } from "@alkemart/shared/storefront-badges"
import { apiFetch } from "../../lib/api"

/**
 * Real catalog data for the studio canvas, so layers render what buyers
 * will see instead of grey placeholders.
 *
 * Everything here reads the public store endpoints (`/store/catalog`,
 * `/store/categories`) — the same data the storefront renders — so the
 * canvas tracks the live catalogue including price, art and stock.
 */

export type PreviewProduct = {
  productId: string
  title: string
  categoryHandle: string
  categoryName: string
  imageUrl: string | null
  fromPricePesewas: string
  bestOfferId: string
  offerCount: number
  sellerHandle: string
  sellerName: string
  availableQty: number
  createdAt: string | null
  currency: string
}

type CatalogResponse = {
  items: PreviewProduct[]
  total: number
}

function params(input: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) search.set(key, String(value))
  }
  return search.toString()
}

export function fetchPreviewCatalog(input: { category?: string; limit?: number; sort?: "newest" }): Promise<CatalogResponse> {
  return apiFetch<CatalogResponse>(`/store/catalog?${params({ category: input.category, limit: input.limit ?? 12, sort: input.sort })}`)
}

/** Newest listings pool: featured shelves and manual-ID resolution. */
export function usePreviewFeatured(limit = 24) {
  return useQuery({
    queryKey: ["studio-preview", "featured", limit],
    queryFn: () => fetchPreviewCatalog({ limit, sort: "newest" }),
    staleTime: 120_000,
  })
}

export type PreviewShop = {
  id: string
  handle: string
  name: string
  logo?: string | null
  banner?: string | null
  location?: string | null
  availability?: "open" | "paused"
  ratingAvg?: number | null
  ratingCount?: number
  deliveryMinutes?: number | null
  badges?: StorefrontBadge[]
}

export function usePreviewShops() {
  return useQuery({
    queryKey: ["studio-preview", "shops"],
    queryFn: () => apiFetch<{ sellers?: PreviewShop[]; items?: PreviewShop[] }>("/store/sellers"),
    staleTime: 120_000,
    select: (data) => data.sellers ?? data.items ?? [],
  })
}

export function usePreviewPopular(input: { limit: number; window?: "7d"; enabled: boolean }) {
  return useQuery({
    queryKey: ["studio-preview", "popular", input.window ?? "all", input.limit],
    queryFn: () => apiFetch<CatalogResponse>(`/store/catalog/popular?${params({ limit: input.limit, window: input.window })}`),
    enabled: input.enabled,
    staleTime: 120_000,
  })
}

/** Source-driven shelf/rail content, mirroring the storefront adapters. */
export function usePreviewShelf(input: { source: "latest" | "category"; categoryHandle?: string; limit: number; enabled: boolean }) {
  return useQuery({
    queryKey: ["studio-preview", "shelf", input.source, input.categoryHandle ?? "all", input.limit],
    queryFn: () => fetchPreviewCatalog({
      limit: input.limit,
      sort: "newest",
      category: input.source === "category" ? input.categoryHandle : undefined,
    }),
    enabled: input.enabled && (input.source !== "category" || Boolean(input.categoryHandle)),
    staleTime: 120_000,
  })
}

export function pesewasToMajor(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n / 100 : null
}
