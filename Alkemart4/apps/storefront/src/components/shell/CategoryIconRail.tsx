import { useMemo, useRef } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import type { IconId } from "@/design/icons"
import { IconSafe } from "@/design/icons"
import {
  iconForCategory,
  resolveRailCategories,
  type RailCategory,
} from "@/lib/catalog-nav"
import { listStoreCategories, DEFAULT_STORE_CATEGORIES } from "@/lib/products"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/skeleton"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"

type Props = {
  categories: RailCategory[]
  activeSlug?: string
  className?: string
}

/**
 * Hubtel-proportioned service reel: large circular chip with the label
 * below it on the page background — no cards. Chips read at 64px with
 * 14px semibold labels, scrollable with edge arrows.
 */
export function CategoryIconRail({
  categories,
  activeSlug,
  className,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return
    const offset = direction === "left" ? -320 : 320
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" })
  }

  if (!categories.length) return null

  return (
    <nav aria-label="Categories" className={cn("relative w-full py-2", className)}>
      <div className="group relative">
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className="absolute -left-3 top-[2rem] z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md hover:bg-tone-neutral-soft"
        >
          <CaretLeft size={16} weight="bold" />
        </button>

        <div
          ref={scrollRef}
          className="scrollbar-none flex w-full items-start justify-start gap-4 overflow-x-auto px-1 py-1 scroll-smooth sm:gap-5"
        >
          {categories.map((c) => (
            <RailItem
              key={c.id}
              slug={(c.handle || c.id).toLowerCase()}
              label={c.name}
              iconId={c.icon ?? iconForCategory(c.name, c.handle)}
              active={
                activeSlug === (c.handle || c.id).toLowerCase() ||
                (c.children ?? []).some((ch) => ch.handle === activeSlug)
              }
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className="absolute -right-3 top-[2rem] z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md hover:bg-tone-neutral-soft"
        >
          <CaretRight size={16} weight="bold" />
        </button>
      </div>
    </nav>
  )
}

/** Shimmer loading state for category rail — mirrors chip + label below. */
export function CategoryRailSkeleton() {
  return (
    <div className="flex w-full gap-4 overflow-hidden py-2 sm:gap-5" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex w-20 shrink-0 flex-col items-center gap-2 sm:w-24"
        >
          <Skeleton className="h-16 w-16 rounded-full sm:h-[4.5rem] sm:w-[4.5rem]" />
          <Skeleton className="h-3.5 w-16 rounded-md" />
        </div>
      ))}
    </div>
  )
}

/** Fetches department list and renders Hubtel category reel. */
export function CategoryReel({
  activeSlug,
  className,
}: {
  activeSlug?: string
  className?: string
}) {
  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    staleTime: 5 * 60_000,
  })

  // Same fallback as the homepage: an empty catalogue response must not
  // blank discovery.
  const categories = useMemo(
    () =>
      resolveRailCategories(
        (catsQ.data?.length ?? 0) > 0 ? catsQ.data! : DEFAULT_STORE_CATEGORIES,
      ),
    [catsQ.data],
  )

  if (catsQ.isLoading) {
    return <CategoryRailSkeleton />
  }

  return (
    <CategoryIconRail
      categories={categories}
      activeSlug={activeSlug}
      className={className}
    />
  )
}

function RailItem(props: {
  slug: string
  label: string
  iconId: IconId
  active: boolean
}) {
  return (
    <Link
      to="/categories/$slug"
      params={{ slug: props.slug }}
      className="group flex w-20 shrink-0 flex-col items-center gap-2 sm:w-24"
    >
      <span
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full bg-tone-neutral-soft sm:h-[4.5rem] sm:w-[4.5rem]",
          props.active
            ? "text-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
            : "text-foreground",
        )}
      >
        <IconSafe name={props.iconId} size={28} preferAsset />
      </span>
      <span className="line-clamp-2 min-h-[2.5rem] w-full px-0.5 text-center text-sm font-semibold leading-snug text-foreground">
        {props.label}
      </span>
    </Link>
  )
}
