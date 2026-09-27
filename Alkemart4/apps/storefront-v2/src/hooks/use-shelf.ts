import { useQueries, useQuery } from "@tanstack/react-query"
import {
  currentDaypart,
  DAYPART_LABEL,
  type HomeShelfSource,
} from "@alkemart/shared/homepage"
import {
  getStoreProduct,
  listPopularProducts,
  listStoreProducts,
  type StoreCategory,
  type StoreProductCard,
} from "@/lib/products"
import { listStoreVendors, type StoreVendor } from "@/lib/vendors"
import { matchesArea, useDeliverTo } from "@/lib/deliver-to"
import { readPin, sortByDistance } from "@/lib/nearby"
import { qk } from "@/hooks/use-store"

export type ShelfResolution = {
  products: StoreProductCard[]
  loading: boolean
  error?: unknown
  /** Replaces the configured title when the rule names itself (dayparts). */
  titleOverride?: string
  /** Why a resolved shelf is empty, in buyer words. */
  emptyReason?: string
}

/**
 * Resolve a homepage shelf source into products. Every rule resolves from
 * real data or to nothing — never a backfill from an unrelated slice.
 */
export function useShelf(opts: {
  source: HomeShelfSource
  limit: number
  categoryId?: string
  categories: StoreCategory[]
  featured: StoreProductCard[]
  featuredLoading: boolean
  productIds?: string[]
  daypartCategoryIds?: Partial<Record<"breakfast" | "lunch" | "supper" | "late", string>>
}): ShelfResolution {
  const { source, limit, categories, featured, featuredLoading, productIds = [] } = opts
  const [area] = useDeliverTo()
  const daypart = currentDaypart(new Date())
  const findCat = (id?: string) =>
    id ? categories.find((c) => c.id === id || c.handle === id) : undefined
  const category =
    source === "daypart" ? findCat(opts.daypartCategoryIds?.[daypart]) : findCat(opts.categoryId)

  const wantsCatalog =
    source === "latest" ||
    source === "category" ||
    source === "near_me" ||
    source === "top_rated" ||
    (source === "daypart" && Boolean(category))
  // Client-ranked rules need a wider page than the shelf shows.
  const wide = source === "near_me" || source === "top_rated"

  const catalogQ = useQuery({
    queryKey: ["store", "shelf", "catalog", category?.handle ?? "all", wide, limit],
    queryFn: () =>
      listStoreProducts({
        limit: wide ? Math.max(limit * 4, 48) : limit,
        sort: "newest",
        categoryHandle: category?.handle ?? undefined,
      }),
    enabled: wantsCatalog,
    staleTime: 120_000,
  })

  const popularQ = useQuery({
    queryKey: ["store", "shelf", "popular", source, limit],
    queryFn: () => listPopularProducts({ limit, ...(source === "trending" ? { window: "7d" as const } : {}) }),
    enabled: source === "most_ordered" || source === "trending",
    staleTime: 120_000,
  })

  const vendorsQ = useQuery({
    queryKey: ["store", "vendors"],
    queryFn: () => listStoreVendors(),
    enabled: source === "near_me" && Boolean(area),
    staleTime: 300_000,
  })

  // Manual curation: fetch the admin's picks by id (not only those that
  // happen to be among the newest listings).
  const manualQs = useQueries({
    queries: (source === "manual" ? productIds.slice(0, limit) : []).map((id) => ({
      queryKey: qk.product(id),
      queryFn: () => getStoreProduct(id),
      staleTime: 120_000,
      retry: false,
    })),
  })

  switch (source) {
    case "manual": {
      const picks = manualQs.flatMap((q) => (q.data ? [q.data] : []))
      return {
        products: picks,
        loading: manualQs.some((q) => q.isLoading),
        emptyReason: "This curated shelf has no live products yet.",
      }
    }
    case "featured":
      return { products: featured.slice(0, limit), loading: featuredLoading && featured.length === 0 }
    case "most_ordered":
    case "trending":
      return {
        products: (popularQ.data?.products ?? []).slice(0, limit),
        loading: popularQ.isLoading,
        error: popularQ.error,
        emptyReason: "Nothing has sold enough yet to rank.",
      }
    case "top_rated": {
      const rated = (catalogQ.data?.products ?? [])
        .filter((p) => p.ratingAvg != null && (p.ratingCount ?? 0) > 0)
        .sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
      return {
        products: rated.slice(0, limit),
        loading: catalogQ.isLoading,
        error: catalogQ.error,
        emptyReason: "No buyer has reviewed an order yet.",
      }
    }
    case "daypart":
      return {
        products: category ? (catalogQ.data?.products ?? []).slice(0, limit) : [],
        loading: Boolean(category) && catalogQ.isLoading,
        titleOverride: DAYPART_LABEL[daypart],
        emptyReason: "No category is set for this part of the day.",
      }
    case "near_me": {
      if (!area) return { products: [], loading: false, emptyReason: "Choose a delivery area to see shops near you." }
      const local = new Set(
        (vendorsQ.data ?? []).filter((v) => matchesArea(v.location, area)).map((v) => v.slug),
      )
      return {
        products: (catalogQ.data?.products ?? [])
          .filter((p) => p.seller?.handle && local.has(p.seller.handle))
          .slice(0, limit),
        loading: catalogQ.isLoading || vendorsQ.isLoading,
        emptyReason: `No shops in ${area} are selling this yet.`,
      }
    }
    default:
      return {
        products: (catalogQ.data?.products ?? []).slice(0, limit),
        loading: catalogQ.isLoading,
        error: catalogQ.error,
      }
  }
}

/** Store rail sources: rules over the shop directory, or a manual pick list. */
export function useStoreRail(source: "top_rated" | "fastest" | "newest" | "near_me" | "manual", limit: number, handles: string[] = []) {
  const [area] = useDeliverTo()
  const q = useQuery({ queryKey: ["store", "vendors"], queryFn: listStoreVendors, staleTime: 300_000 })
  const open = (q.data ?? []).filter((v) => v.availability !== "paused")
  let shops: StoreVendor[]
  /** False when a ranking rule had nothing to rank — the title must not claim it. */
  let ranked = true
  switch (source) {
    case "manual": {
      const bySlug = new Map(open.map((v) => [v.slug, v]))
      shops = handles.flatMap((h) => (bySlug.has(h) ? [bySlug.get(h)!] : []))
      break
    }
    case "top_rated":
      shops = open
        .filter((v) => v.ratingAvg != null && (v.ratingCount ?? 0) > 0)
        .sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
      // A young marketplace may have no ratings yet — show its shops, unranked.
      if (shops.length === 0) {
        shops = open
        ranked = false
      }
      break
    case "fastest":
      shops = open
        .filter((v) => v.deliveryMinutes != null)
        .sort((a, b) => (a.deliveryMinutes ?? 0) - (b.deliveryMinutes ?? 0))
      break
    case "near_me": {
      const pin = readPin()
      shops = pin ? sortByDistance(open, pin) : area ? open.filter((v) => matchesArea(v.location, area)) : open
      break
    }
    default:
      // Cards carry no creation date; the server's computed "new shop" badge does.
      shops = [
        ...open.filter((v) => v.badges?.some((b) => b.id === "new_shop")),
        ...open.filter((v) => !v.badges?.some((b) => b.id === "new_shop")),
      ]
  }
  return { shops: shops.slice(0, limit), ranked, loading: q.isLoading, error: q.error, refetch: q.refetch }
}
