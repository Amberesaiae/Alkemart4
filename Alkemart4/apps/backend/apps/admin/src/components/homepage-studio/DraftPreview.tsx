import { categoryArtFor } from "@alkemart/shared/category-art"
import type { CategoryBannerTile, HomeSection } from "@alkemart/shared/homepage"
import { categoryRatioOf, categoryTilesOf, currentDaypart, DAYPART_LABEL, isSectionVisible } from "@alkemart/shared/homepage"
import { CaretDown, CaretUp, Copy, DotsThree, Eye, EyeSlash, Plus, WarningCircle } from "@phosphor-icons/react"
import { Fragment } from "react"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Skeleton,
  MerchCategoryTileBody,
  MerchCountdownBanner,
  MerchDealBadge,
  MerchDealRail,
  MerchEmpty,
  MerchMarquee,
  MerchGridSection,
  MerchPromoBand,
  MerchPromoGrid,
  MerchPromoHero,
  MerchShelf,
  MerchValueGrid,
  StoreCardArt,
  StoreCardBadges,
  StoreCardFacts,
  storeCardShell,
  cn,
  merchCategoryTileClass,
} from "@workspace/ui"
import { Storefront } from "@phosphor-icons/react"
import { usePreviewPopular, usePreviewShelf, usePreviewShops, type PreviewProduct, type PreviewShop } from "./preview-data"
import { sectionLabels, sectionName, storefrontBase, type SectionIssue } from "./model"
import { StudioProductCard } from "./StudioProductCard"

export type PreviewCategory = {
  id: string
  name: string
  handle?: string | null
}

/**
 * Single-pane draft canvas: the working draft rendered with the exact
 * shared storefront components fed with real catalogue data — the same
 * products, prices, art and fallbacks buyers see. Placeholders are gone:
 * shelves and rails resolve their source (featured / latest / category /
 * manual) against `/store/catalog`, category banners resolve canonical
 * photography, and empty sources render the storefront's honest empty
 * states. Links stay inert (clicking a layer selects it for editing),
 * and hidden sections render dimmed unless showHidden is off.
 */
export function DraftPreview({ sections, selectedId, issues, showHidden, featured, categories, topCategories, onSelect, onMove, onToggleVisible, onDuplicate, onAddAt, onAddFirst }: {
  sections: HomeSection[]
  selectedId: string | null
  issues: SectionIssue[]
  showHidden: boolean
  featured: PreviewProduct[]
  categories: PreviewCategory[]
  topCategories: PreviewCategory[]
  onSelect: (section: HomeSection) => void
  onMove: (id: string, delta: -1 | 1) => void
  onToggleVisible: (id: string) => void
  onDuplicate: (id: string) => void
  onAddAt: (index: number) => void
  onAddFirst: () => void
}) {
  if (!sections.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-4">
        <EmptyState
          title="Empty homepage"
          description="Add sections from the library. The storefront falls back to the default category mosaic until managed content is published."
          action={<Button onClick={onAddFirst}>Add section</Button>}
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col">
      {sections.map((section, index) => {
        if (!showHidden && !isSectionVisible(section)) return null
        const name = sectionName(section)
        const live = isSectionVisible(section)
        const errorCount = issues.filter((issue) => issue.sectionId === section.id).length
        const isSelected = section.id === selectedId
        return (
          <Fragment key={section.id}>
            <InsertGap index={index} name={name} onAdd={() => onAddAt(index)} />
            <article
              aria-label={`${name}, ${sectionLabels[section.type]}, layer ${index + 1} of ${sections.length}${live ? "" : ", hidden from buyers"}${errorCount ? `, ${errorCount} problems to fix` : ""}`}
              className={cn(
                "group overflow-hidden rounded-lg border bg-white",
                errorCount
                  ? "border-destructive"
                  : isSelected
                    ? "border-primary shadow-md"
                    : "border-border shadow-xs hover:border-foreground/30",
              )}
            >
              <div className="flex items-center gap-2 border-b border-border/70 px-2.5 py-1.5">
                <span className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-tone-neutral-soft text-tone-neutral-ink",
                )} aria-hidden="true">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-muted-foreground">
                  {sectionLabels[section.type]}
                </span>
                {!live ? (
                  <span className="shrink-0 rounded-md bg-tone-neutral-soft px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-tone-neutral-ink">
                    Hidden
                  </span>
                ) : null}
                {errorCount ? (
                  <Badge variant="destructive" className="shrink-0 px-1.5 py-0 text-[11px]">
                    <WarningCircle className="mr-0.5 h-3 w-3" aria-hidden="true" />
                    {errorCount} to fix
                  </Badge>
                ) : null}
                <span className="flex shrink-0 items-center focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100" role="group" aria-label={`Stack ${name}`}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                    aria-label={`Move ${name} earlier`}
                    title="Move earlier"
                    onClick={() => onMove(section.id, -1)}
                  >
                    <CaretUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === sections.length - 1}
                    aria-label={`Move ${name} later`}
                    title="Move later"
                    onClick={() => onMove(section.id, 1)}
                  >
                    <CaretDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`More actions for ${name}`}
                        title="More actions"
                      >
                        <DotsThree className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onToggleVisible(section.id)}>
                        {live ? <Eye className="mr-2 h-4 w-4" aria-hidden="true" /> : <EyeSlash className="mr-2 h-4 w-4" aria-hidden="true" />}
                        {live ? "Hide section" : "Show section"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onDuplicate(section.id)}>
                        <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                        Duplicate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="button"
                    id={`layer-edit-${section.id}`}
                    variant={isSelected ? "secondary" : "ghost"}
                    size="sm"
                    className="ml-1 h-7 px-2.5 text-xs"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(section)}
                  >
                    Edit
                  </Button>
                </span>
              </div>
              <div
                onClick={() => onSelect(section)}
                className={cn("cursor-pointer", !live && "opacity-60")}
              >
                <span className="sr-only">Edit {name}.</span>
                <DraftSection section={section} featured={featured} categories={categories} topCategories={topCategories} />
              </div>
            </article>
          </Fragment>
        )
      })}
      <InsertGap index={sections.length} last onAdd={() => onAddAt(sections.length)} />
    </div>
  )
}

/**
 * Totally quiet until hovered or focused: a hairline with a plus chip.
 * Always visible on touch layouts, where there is no hover.
 */
function InsertGap({ index, last, name, onAdd }: { index: number; last?: boolean; name?: string; onAdd: () => void }) {
  return (
    <div className="group/gap relative flex items-center justify-center py-1">
      <span className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-border" aria-hidden="true" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        aria-label={last ? "Add section at the end" : `Insert section before ${name ?? `position ${index + 1}`}`}
        title={last ? "Add section at the end" : "Insert section here"}
        className="relative h-6 gap-1 rounded-full bg-white px-2.5 text-[11px] shadow-xs focus-visible:opacity-100 lg:opacity-0 lg:group-hover/gap:opacity-100 lg:group-focus-within/gap:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        {last ? "Add" : null}
      </Button>
    </div>
  )
}

function DraftSection({ section, featured, categories, topCategories }: {
  section: HomeSection
  featured: PreviewProduct[]
  categories: PreviewCategory[]
  topCategories: PreviewCategory[]
}) {
  if (section.type === "promo_hero") return <MerchPromoHero {...section} layout={section.layout ?? "split"} interactive={false} />
  if (section.type === "promo_grid") return <MerchPromoGrid {...section} variant={section.variant ?? "cards"} interactive={false} />
  if (section.type === "promo_band") return <MerchPromoBand {...section} interactive={false} />
  if (section.type === "countdown_banner") return <MerchCountdownBanner {...section} interactive={false} />
  if (section.type === "marquee") return <MerchMarquee {...section} interactive={false} />
  if (section.type === "deal_rail") return <StudioDealRail section={section} categories={categories} featured={featured} />
  if (section.type === "category_grid") return <StudioCategoryBanners section={section} categories={categories} topCategories={topCategories} />
  if (section.type === "product_shelf") return <StudioShelf section={section} categories={categories} featured={featured} />
  if (section.type === "store_rail") return <StudioStoreRail section={section} />
  return <MerchValueGrid title={section.title} subtitle={section.subtitle} items={section.items} />
}

function categoryById(categories: PreviewCategory[], id: string | undefined): PreviewCategory | undefined {
  if (!id) return undefined
  return categories.find((category) => category.id === id)
}

function resolveManual(featured: PreviewProduct[], productIds: string[] | undefined): { products: PreviewProduct[]; missing: number } {
  const byId = new Map(featured.map((product) => [product.productId, product]))
  const products: PreviewProduct[] = []
  let missing = 0
  for (const id of productIds ?? []) {
    const product = byId.get(id)
    if (product) products.push(product)
    else missing += 1
  }
  return { products, missing }
}

function StudioShelf({ section, categories, featured }: {
  section: Extract<HomeSection, { type: "product_shelf" }>
  categories: PreviewCategory[]
  featured: PreviewProduct[]
}) {
  const daypart = currentDaypart(new Date())
  const daypartCategory = section.source === "daypart"
    ? categoryById(categories, section.daypartCategoryIds?.[daypart])
    : undefined
  const category = section.source === "daypart" ? daypartCategory : categoryById(categories, section.categoryId)
  const liveQ = usePreviewShelf({
    source: section.source === "category" || section.source === "daypart" ? "category" : "latest",
    categoryHandle: category?.handle ?? undefined,
    limit: section.limit,
    enabled: section.source === "latest" || section.source === "category" || (section.source === "daypart" && Boolean(daypartCategory)),
  })
  const popularQ = usePreviewPopular({
    limit: section.limit,
    window: section.source === "trending" ? "7d" : undefined,
    enabled: section.source === "most_ordered" || section.source === "trending",
  })

  if (section.source === "near_me") {
    return <MerchEmpty title={section.title} body="This shelf fills from each buyer’s saved delivery area. Preview it on the storefront." />
  }

  if (section.source === "daypart" && !section.daypartCategoryIds?.[daypart]) {
    return <MerchEmpty title={DAYPART_LABEL[daypart]} body="No category is set for this part of the day." />
  }

  if (section.source === "manual") {
    const { products, missing } = resolveManual(featured, section.productIds)
    if (!products.length) {
      return <MerchEmpty title={section.title} body="This curated shelf has no matching live products yet. Link valid product IDs in the slide-over." />
    }
    return (
      <StudioShelfBody title={section.title} subtitle={section.subtitle} layout={section.layout ?? "grid"} products={products.slice(0, section.limit)}>
        {missing ? <p className="mt-1 text-[11px] text-muted-foreground">{missing} selected {missing === 1 ? "ID is" : "IDs are"} not on sale right now.</p> : null}
      </StudioShelfBody>
    )
  }

  if (section.source === "category" && !category) {
    return <MerchEmpty title={section.title} body="The linked category is no longer in the catalogue. Pick another category in the slide-over." />
  }
  const title = section.source === "daypart" ? DAYPART_LABEL[daypart] : section.title
  const loading = section.source === "most_ordered" || section.source === "trending"
    ? popularQ.isLoading
    : section.source !== "featured" && liveQ.isLoading
  if (loading) {
    return (
      <section className="space-y-4" aria-label={title}>
        <h2 className="px-1 text-xl font-extrabold tracking-tight">{title}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: Math.min(section.limit, 4) }).map((_, index) => (
            <Skeleton key={index} className="aspect-[3/4] rounded-lg bg-tone-neutral-soft" />
          ))}
        </div>
      </section>
    )
  }
  const products =
    section.source === "featured" ? featured.slice(0, section.limit)
    : section.source === "most_ordered" || section.source === "trending" ? (popularQ.data?.items ?? [])
    : (liveQ.data?.items ?? [])
  if (!products.length) {
    return <MerchEmpty title={title} body="No live products match this shelf yet." />
  }
  return <StudioShelfBody title={title} subtitle={section.subtitle} layout={section.layout ?? "grid"} products={products} />
}

function StudioShelfBody({ title, subtitle, layout, products, children }: {
  title: string
  subtitle?: string
  layout: "grid" | "carousel"
  products: PreviewProduct[]
  children?: React.ReactNode
}) {
  if (layout === "carousel") {
    return (
      <MerchShelf title={title} subtitle={subtitle} layout="carousel">
        {products.map((product) => (
          <div key={product.productId} className="w-44 shrink-0 snap-start sm:w-56">
            <StudioProductCard product={product} />
          </div>
        ))}
        {children}
      </MerchShelf>
    )
  }
  return (
    <MerchShelf title={title} subtitle={subtitle}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {products.map((product) => <StudioProductCard key={product.productId} product={product} />)}
      </div>
      {children}
    </MerchShelf>
  )
}

function StudioDealRail({ section, categories, featured }: {
  section: Extract<HomeSection, { type: "deal_rail" }>
  categories: PreviewCategory[]
  featured: PreviewProduct[]
}) {
  const category = categoryById(categories, section.categoryId)
  const liveQ = usePreviewShelf({
    source: section.source === "category" || section.source === "latest" ? section.source : "latest",
    categoryHandle: category?.handle ?? undefined,
    limit: section.limit,
    enabled: section.source === "latest" || section.source === "category",
  })
  const popularQ = usePreviewPopular({
    limit: section.limit,
    window: section.source === "trending" ? "7d" : undefined,
    enabled: section.source === "most_ordered" || section.source === "trending",
  })

  if (section.source === "near_me") {
    return <MerchEmpty title={section.title} body="This rail fills from each buyer’s saved delivery area. Preview it on the storefront." />
  }

  let products: PreviewProduct[] = []
  let missing = 0
  if (section.source === "manual") {
    const resolved = resolveManual(featured, section.productIds)
    products = resolved.products
    missing = resolved.missing
  } else if (section.source === "featured") {
    products = featured.slice(0, section.limit)
  } else if (section.source === "most_ordered" || section.source === "trending") {
    products = popularQ.data?.items ?? []
  } else {
    products = liveQ.data?.items ?? []
  }

  if (section.source === "category" && !category) {
    return <MerchEmpty title={section.title} body="The linked category is no longer in the catalogue. Pick another category in the slide-over." />
  }
  if (!products.length) {
    if (liveQ.isLoading) {
      return (
        <MerchDealRail title={section.title} subtitle={section.subtitle} eyebrow={section.eyebrow} countdownTo={section.countdownTo}>
          {Array.from({ length: Math.min(section.limit, 4) }).map((_, index) => (
            <Skeleton key={index} className="aspect-[3/4] w-44 shrink-0 rounded-lg bg-tone-neutral-soft sm:w-56" />
          ))}
        </MerchDealRail>
      )
    }
    return <MerchEmpty title={section.title} body="No live products match this deal yet." />
  }

  return (
    <MerchDealRail title={section.title} subtitle={section.subtitle} eyebrow={section.eyebrow} countdownTo={section.countdownTo}>
      {products.slice(0, section.limit).map((product) => (
        <div key={product.productId} className="relative w-44 shrink-0 snap-start sm:w-56">
          {section.badge ? <MerchDealBadge label={section.badge} /> : null}
          <StudioProductCard product={product} />
        </div>
      ))}
      {missing ? <p className="mt-1 w-full text-[11px] text-muted-foreground">{missing} selected {missing === 1 ? "ID is" : "IDs are"} not on sale right now.</p> : null}
    </MerchDealRail>
  )
}

function StudioCategoryBanners({ section, categories, topCategories }: {
  section: Extract<HomeSection, { type: "category_grid" }>
  categories: PreviewCategory[]
  topCategories: PreviewCategory[]
}) {
  const base = storefrontBase()
  const variant = section.variant ?? "tiles"
  const ratio = categoryRatioOf(section)
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  type ResolvedTile = { tile: CategoryBannerTile; category: PreviewCategory }
  const configured: ResolvedTile[] = categoryTilesOf(section)
    .map((tile) => ({ tile, category: tile.categoryId ? categoryById.get(tile.categoryId) : undefined }))
    .filter((entry): entry is ResolvedTile => Boolean(entry.category))

  // Same fallback as the storefront: real top-level departments rather
  // than a hole. (An empty tile list still blocks saving — flagged inline.)
  const entries: ResolvedTile[] = configured.length
    ? configured
    : topCategories
        .slice(0, variant === "mosaic" ? 4 : section.columns)
        .map((category, index) => ({
          tile: { categoryId: category.id, slot: index < 2 ? ("feature" as const) : ("standard" as const) },
          category,
        }))

  const limit = variant === "mosaic" ? 4 : 16
  const shown = entries.slice(0, limit)
  const skipped = categoryTilesOf(section).length - configured.length

  if (!shown.length) {
    return <MerchEmpty title={section.title} body={section.subtitle ?? "Categories will appear here once the catalogue is linked."} />
  }

  return (
    <MerchGridSection
      title={section.title}
      subtitle={section.subtitle}
      columns={section.columns}
      variant={variant}
      action={section.showAllLink === false ? undefined : (
        <span className="text-sm font-bold">View all</span>
      )}
    >
      {shown.map(({ tile, category }, index) => {
        const feature = tile.slot ? tile.slot === "feature" : variant === "mosaic" && index < 2
        const label = tile.label || category.name
        const art = categoryArtFor(category.handle)
        const photo = tile.imageUrl || (art ? `${base}${art.photo}` : undefined)
        return (
          <div key={`${section.id}-${category.id}`} className={merchCategoryTileClass({ variant, ratio, feature })}>
            <MerchCategoryTileBody
              label={label}
              badge={tile.badge}
              imageUrl={photo}
              focalPoint={tile.focalPoint}
              imageClassName={art?.objectPos}
              feature={feature}
              variant={variant}
              ratio={ratio}
              fallback={(
                <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-white/85 text-xl font-black text-foreground">
                  {label.trim().charAt(0).toUpperCase() || "·"}
                </span>
              )}
            />
          </div>
        )
      })}
      {skipped > 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {skipped} {skipped === 1 ? "tile points at" : "tiles point at"} a removed category and {skipped === 1 ? "is" : "are"} skipped on the storefront.
        </p>
      ) : null}
    </MerchGridSection>
  )
}

function StudioStoreRail({ section }: { section: Extract<HomeSection, { type: "store_rail" }> }) {
  const shopsQ = usePreviewShops()
  if (section.source === "near_me") {
    return <MerchEmpty title={section.title} body="This rail fills from each buyer’s saved delivery area. Preview it on the storefront." />
  }
  if (shopsQ.isLoading) {
    return (
      <section className="space-y-4" aria-label={section.title}>
        <h2 className="px-1 text-xl font-extrabold tracking-tight">{section.title}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: Math.min(section.limit, 4) }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] rounded-lg bg-tone-neutral-soft" />
          ))}
        </div>
      </section>
    )
  }
  const all = (shopsQ.data ?? []).filter((s) => s.availability !== "paused")
  let shops: PreviewShop[]
  switch (section.source) {
    case "manual": {
      const byHandle = new Map(all.map((s) => [s.handle, s]))
      shops = (section.sellerHandles ?? []).map((h) => byHandle.get(h)).filter((s): s is PreviewShop => Boolean(s))
      break
    }
    case "fastest":
      shops = [...all].sort((a, b) => (a.deliveryMinutes ?? 999) - (b.deliveryMinutes ?? 999))
      break
    case "newest":
      shops = [...all].reverse()
      break
    default:
      shops = [...all].sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
  }
  const shown = shops.slice(0, section.limit)
  if (!shown.length) {
    return <MerchEmpty title={section.title} body="No live shops match this rail yet." />
  }
  const cards = shown.map((shop) => (
    <div key={shop.handle} className={storeCardShell}>
      <StoreCardArt
        src={shop.banner ?? shop.logo}
        className="aspect-[4/3]"
        fallback={<Storefront className="h-8 w-8" aria-hidden />}
      />
      <div className="flex flex-col gap-1 p-3">
        <span className="truncate text-sm font-bold tracking-tight">{shop.name}</span>
        {shop.location ? <span className="truncate text-xs text-muted-foreground">{shop.location}</span> : null}
        <StoreCardFacts store={shop} />
        <StoreCardBadges badges={shop.badges} max={1} className="pt-0.5" />
      </div>
    </div>
  ))
  if (section.layout === "carousel") {
    return (
      <MerchShelf title={section.title} subtitle={section.subtitle} layout="carousel">
        {shown.map((shop, i) => (
          <div key={shop.handle} className="w-52 shrink-0 snap-start sm:w-60">{cards[i]}</div>
        ))}
      </MerchShelf>
    )
  }
  return (
    <MerchShelf title={section.title} subtitle={section.subtitle}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{cards}</div>
    </MerchShelf>
  )
}
