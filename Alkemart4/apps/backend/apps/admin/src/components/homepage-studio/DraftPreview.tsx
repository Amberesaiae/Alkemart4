import type { HomeSection } from "@alkemart/shared/homepage"
import { isSectionVisible } from "@alkemart/shared/homepage"
import {
  EmptyState,
  MerchGridSection,
  MerchPromoBand,
  MerchPromoGrid,
  MerchPromoHero,
  MerchShelf,
  MerchValueGrid,
  cn,
} from "@workspace/ui"
import { sectionLabels, sectionName } from "./model"

/**
 * Draft perspective: renders the working draft with the exact shared
 * storefront components, so edits show instantly. Clicking (or
 * Enter/Space on) a block focuses its settings — the Sanity Presentation
 * click-to-edit pattern. Hidden or out-of-window sections render dimmed
 * with a badge instead of disappearing, so the draft stays reviewable.
 */
export function DraftPreview({ sections, selectedId, onSelect, categoryNames }: {
  sections: HomeSection[]
  selectedId: string | null
  onSelect: (section: HomeSection) => void
  categoryNames: Map<string, string>
}) {
  if (!sections.length) {
    return (
      <div className="p-4">
        <EmptyState
          title="Empty homepage"
          description="Add sections from the library. The storefront falls back to the default category mosaic until managed content is published."
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5 p-4">
      {sections.map((section, index) => {
        const name = sectionName(section)
        const live = isSectionVisible(section)
        const ring = section.id === selectedId
          ? "rounded-2xl outline-none ring-2 ring-primary ring-offset-2"
          : "rounded-2xl outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:ring-2 hover:ring-ring/40 hover:ring-offset-2"
        return (
          <div
            key={section.id}
            role="button"
            tabIndex={0}
            aria-pressed={section.id === selectedId}
            onClick={() => onSelect(section)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(section) }
            }}
            className={cn(!live && "opacity-60", ring)}
          >
            <span className="sr-only">
              Edit {name}, {sectionLabels[section.type]}, position {index + 1} of {sections.length}{live ? "" : ", hidden from buyers"}.
            </span>
            {!live ? (
              <p className="mb-1.5 inline-block rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Hidden from buyers
              </p>
            ) : null}
            <DraftSection section={section} categoryNames={categoryNames} />
          </div>
        )
      })}
    </div>
  )
}

function DraftSection({ section, categoryNames }: { section: HomeSection; categoryNames: Map<string, string> }) {
  if (section.type === "promo_hero") return <MerchPromoHero {...section} layout={section.layout ?? "split"} interactive={false} compact />
  if (section.type === "promo_grid") return <MerchPromoGrid {...section} variant={section.variant ?? "cards"} interactive={false} compact />
  if (section.type === "promo_band") return <MerchPromoBand {...section} interactive={false} compact />
  if (section.type === "category_grid") {
    const names = section.categoryIds.map((id) => categoryNames.get(id) ?? "Category").slice(0, Math.max(section.columns, 4))
    const placeholders = names.length ? names : Array.from({ length: 4 }, (_, i) => `Category ${i + 1}`)
    return (
      <MerchGridSection title={section.title} subtitle={section.subtitle} columns={section.columns} variant={section.variant ?? "tiles"}>
        {placeholders.map((placeholder, placeholderIndex) => (
          <div key={placeholderIndex} className="flex aspect-square flex-col justify-end rounded-xl bg-muted p-2 text-xs font-semibold">
            <span className="rounded-md bg-background/90 px-2 py-1">{placeholder}</span>
          </div>
        ))}
      </MerchGridSection>
    )
  }
  if (section.type === "product_shelf") {
    return (
      <MerchShelf title={section.title} subtitle={section.subtitle} layout={section.layout ?? "grid"}>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, placeholderIndex) => (
            <div key={placeholderIndex} className="aspect-[3/4] rounded-xl border border-border bg-card p-2">
              <div className="h-2/3 rounded-lg bg-muted" />
              <div className="mt-2 h-2 rounded bg-foreground/10" />
            </div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Source: {section.source}
          {section.source === "category" && !section.categoryId ? " · pick a category" : ""}
          {section.source === "manual" && !(section.productIds ?? []).length ? " · add product IDs" : ""}
        </p>
      </MerchShelf>
    )
  }
  return <MerchValueGrid title={section.title} subtitle={section.subtitle} items={section.items} compact />
}
