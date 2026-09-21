import { useQuery } from "@tanstack/react-query"
import {
  currentDaypart,
  DAYPART_LABEL,
  type HomeShelfSource,
} from "@alkemart/shared/homepage"
import {
  DEMO_CATALOG_PRODUCTS,
  listPopularProducts,
  listStoreProducts,
  type StoreCategory,
  type StoreProductCard,
} from "@/lib/products"
import { listStoreVendors } from "@/lib/vendors"
import { matchesArea, useDeliverTo } from "@/lib/deliver-to"

/**
 * Resolves a shelf's source into products.
 *
 * Curated sources (`featured`, `manual`, `category`, `latest`) answer from
 * picks. Rule sources answer from the buyer's own context — the clock, their
 * saved area, what the marketplace actually sells — so one configured section
 * merchandises itself differently per buyer and per hour.
 *
 * Every rule resolves from real data or resolves to nothing. A popularity
 * shelf with no orders behind it, or a "near you" shelf with no local shops,
 * returns empty so the caller can say so honestly rather than backfilling
 * with an unrelated slice of the catalogue.
 */
export type ShelfResolution = {
  products: StoreProductCard[]
  loading: boolean
  /** Replaces the configured title when the rule names itself (dayparts). */
  titleOverride?: string
  /** Why a resolved-but-empty shelf is empty, in buyer-facing words. */
  emptyReason?: string
}

export function useShelfSource(opts: {
  source: HomeShelfSource
  limit: number
  category?: StoreCategory
  categories?: StoreCategory[]
  featured: StoreProductCard[]
  /** True while the page's featured list is still in flight (it owns `featured`). */
  featuredLoading?: boolean
  productIds?: string[]
  daypartCategoryIds?: Partial<Record<"breakfast" | "lunch" | "supper" | "late", string>>
  /** Stabilises query keys across sections of the same type. */
  scope: string
}): ShelfResolution {
  const { source, limit, category, categories, featured, featuredLoading, productIds, daypartCategoryIds, scope } = opts
  const [area] = useDeliverTo()

  const daypart = currentDaypart(new Date())
  const daypartCategoryId = source === "daypart" ? daypartCategoryIds?.[daypart] : undefined
  const daypartCategory =
    daypartCategoryId != null
      ? categories?.find((c) => c.id === daypartCategoryId || c.handle === daypartCategoryId)
      : undefined

  const wantsCatalog =
    source === "latest" ||
    source === "category" ||
    source === "near_me" ||
    source === "top_rated" ||
    (source === "daypart" && Boolean(daypartCategory))

  // Rules that rank client-side (near me, top rated) need a wider page than
  // the shelf shows, or the ranking only ever sees the first few products.
  const needsWidePage = source === "near_me" || source === "top_rated"

  const effectiveCategory = source === "daypart" ? daypartCategory : category

  const catalogQ = useQuery({
    queryKey: [
      "store",
      "shelf",
      scope,
      source,
      effectiveCategory?.id ?? "all",
      // "Near me" fetches a wider page and narrows client-side, so the area
      // has to be part of the key or switching areas serves a stale slice.
      source === "near_me" ? (area ?? "anywhere") : "",
      limit,
    ],
    queryFn: () =>
      listStoreProducts({
        limit: needsWidePage ? Math.max(limit * 4, 48) : limit,
        sort: "newest",
        ...(effectiveCategory
          ? { categoryId: effectiveCategory.id, categoryHandle: effectiveCategory.handle || undefined }
          : {}),
      }),
    // No demo seed as placeholder: a shelf shows its shimmer until real cards
    // arrive, rather than the same six stand-in products every shelf reuses.
    enabled: wantsCatalog,
    staleTime: 120_000,
  })

  const popularQ = useQuery({
    queryKey: ["store", "shelf", scope, source, limit],
    queryFn: () =>
      listPopularProducts({
        limit,
        ...(source === "trending" ? { window: "7d" as const } : {}),
      }),
    enabled: source === "most_ordered" || source === "trending",
    staleTime: 120_000,
  })

  // Which shops sit in the buyer's area — only fetched when a rule needs it.
  const vendorsQ = useQuery({
    queryKey: ["store", "vendors"],
    queryFn: () => listStoreVendors(),
    enabled: source === "near_me" && Boolean(area),
    staleTime: 300_000,
  })

  if (source === "manual") {
    const byId = new Map(featured.map((p) => [p.id, p]))
    const picks = (productIds ?? [])
      .map((id) => byId.get(id))
      .filter((p): p is StoreProductCard => Boolean(p))
    return {
      products: picks.slice(0, limit),
      loading: false,
      emptyReason: picks.length
        ? undefined
        : "This curated shelf has no matching live products yet.",
    }
  }

  if (source === "featured") {
    // The featured list is the page's own query; a shelf cannot claim to be
    // loaded until that query is.
    return { products: featured.slice(0, limit), loading: Boolean(featuredLoading) && featured.length === 0 }
  }

  if (source === "most_ordered" || source === "trending") {
    const prods = popularQ.data?.products ?? []
    // In flight with nothing behind it yet: say so, so the shelf can shimmer
    // instead of flashing the stand-in catalogue and then replacing it.
    if (popularQ.isLoading && !prods.length) return { products: [], loading: true }
    const list = prods.length ? prods : DEMO_CATALOG_PRODUCTS.slice(0, limit)
    return { products: list.slice(0, limit), loading: false }
  }

  if (source === "top_rated") {
    // Ranked by published reviews and nothing else. Only-order shelves stay
    // honest about a young catalogue; so does this one.
    const rated = (catalogQ.data?.products ?? [])
      .filter((p) => p.ratingAvg != null && (p.ratingCount ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) ||
          (b.ratingCount ?? 0) - (a.ratingCount ?? 0),
      )
    return {
      products: rated.slice(0, limit),
      loading: catalogQ.isLoading,
      emptyReason: "No buyer has reviewed an order yet, so there is no honest rating to rank by.",
    }
  }

  if (source === "daypart") {
    if (!daypartCategoryId) {
      return {
        products: [],
        loading: false,
        titleOverride: DAYPART_LABEL[daypart],
        emptyReason: "No category is set for this part of the day.",
      }
    }
    if (!daypartCategory) {
      return {
        products: [],
        loading: false,
        titleOverride: DAYPART_LABEL[daypart],
        emptyReason: "The category set for this part of the day is no longer in the catalogue.",
      }
    }
    return {
      products: (catalogQ.data?.products ?? []).slice(0, limit),
      loading: catalogQ.isLoading,
      titleOverride: DAYPART_LABEL[daypart],
    }
  }

  if (source === "near_me") {
    if (!area) {
      return {
        products: [],
        loading: false,
        emptyReason: "Choose where you want delivery to see shops near you.",
      }
    }
    const localHandles = new Set(
      (vendorsQ.data ?? [])
        .filter((v) => matchesArea(v.location, area))
        .map((v) => v.slug),
    )
    const local = (catalogQ.data?.products ?? []).filter(
      (p) => p.seller?.handle && localHandles.has(p.seller.handle),
    )
    return {
      products: local.slice(0, limit),
      loading: catalogQ.isLoading || vendorsQ.isLoading,
      titleOverride: undefined,
      emptyReason: `No shops in ${area} are selling this yet.`,
    }
  }

  // latest / category
  return {
    products: (catalogQ.data?.products ?? []).slice(0, limit),
    loading: catalogQ.isLoading,
  }
}

/** The label a daypart shelf should carry right now. */
export function daypartTitle(now: Date): string {
  return DAYPART_LABEL[currentDaypart(now)]
}
