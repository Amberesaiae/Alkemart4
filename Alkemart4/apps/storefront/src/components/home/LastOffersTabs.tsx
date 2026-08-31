import { IconSafe, type IconId } from "@/design/icons"
import { metaFor } from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"

export type OfferTabId =
  | "all"
  | "electronics"
  | "food"
  | "beverages"
  | "personal"
  | "pet"
  | "baby"

export type OfferTab = {
  id: OfferTabId
  label: string
  icon: IconId
  /** Category handle this tab represents (filtered out when absent). */
  handle: string
}

/**
 * Home offers strip tabs — filter chrome only.
 * Icons from CATEGORY_META; tab labels are fixed filter names (not a
 * second taxonomy SoT — category page titles still use API names).
 */
export const OFFER_TABS: OfferTab[] = (
  [
    { id: "electronics", handle: "phones-electronics", label: "Electronics" },
    { id: "food", handle: "food-groceries", label: "Food" },
    { id: "beverages", handle: "beverages", label: "Beverages" },
    { id: "personal", handle: "health-beauty", label: "Personal Care" },
    { id: "pet", handle: "pet-care", label: "Pet Care" },
    { id: "baby", handle: "baby-kids", label: "Baby Care" },
  ] as const
).map((t) => ({
  ...t,
  icon: metaFor(t.handle)?.icon ?? ("cat-all" as IconId),
}))

export type OfferSort = "featured" | "price_asc" | "price_desc" | "newest"
export type OfferView = "grid" | "list"

type Props = {
  active: OfferTabId | "all"
  onChange: (id: OfferTabId | "all") => void
  sort: OfferSort
  onSortChange: (s: OfferSort) => void
  view?: OfferView
  onViewChange?: (v: OfferView) => void
  className?: string
  /** Override the fixed OFFER_TABS list (e.g. only real marketplace categories). */
  tabs?: OfferTab[]
}

export function LastOffersTabs({
  active,
  onChange,
  sort,
  onSortChange,
  view = "grid",
  onViewChange,
  className,
  tabs = OFFER_TABS,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div
        role="tablist"
        aria-label="Filter offers by category"
        className="scrollbar-none flex items-center gap-1 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const isOn = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isOn}
              aria-label={tab.label}
              title={tab.label}
              onClick={() => onChange(isOn ? "all" : tab.id)}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition sm:h-11 sm:w-11",
                isOn
                  ? "bg-muted text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {/* ICONPAK2 webp black monoline */}
              <IconSafe name={tab.icon} size={24} preferAsset />
            </button>
          )
        })}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <label className="sr-only" htmlFor="offers-sort">
          Sort
        </label>
        <select
          id="offers-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as OfferSort)}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="featured">Featured</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="newest">Newest</option>
        </select>

        {onViewChange ? (
          <div
            className="flex overflow-hidden rounded-md border border-border"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              aria-pressed={view === "grid"}
              aria-label="Grid view"
              onClick={() => onViewChange("grid")}
              className={cn(
                "flex h-9 w-9 items-center justify-center",
                view === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <IconSafe name="filter-grid" size={18} preferAsset />
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              aria-label="List view"
              onClick={() => onViewChange("list")}
              className={cn(
                "flex h-9 w-9 items-center justify-center border-l border-border",
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <IconSafe name="filter-list" size={18} preferAsset={false} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
