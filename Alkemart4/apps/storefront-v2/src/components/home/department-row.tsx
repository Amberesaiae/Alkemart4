import type { CategoryBannerTile } from "@alkemart/shared/homepage"
import { CategoryTile } from "@/components/commerce/category-tile"
import { SectionHeader } from "@/components/commerce/section-header"
import type { StoreCategory } from "@/lib/products"
import { cn } from "@/lib/utils"

/**
 * One row of tall department tiles (scrolls on phones). Tiles come from the
 * homepage studio when configured — its art/copy overrides — else the API's
 * top-level departments in buyer order.
 */
export function DepartmentRow({
  title,
  departments,
  tiles,
  className,
}: {
  title?: string
  className?: string
  departments: StoreCategory[]
  tiles: CategoryBannerTile[]
}) {
  const byId = new Map(departments.map((c) => [c.id, c]))
  const configured = tiles.flatMap((t) => {
    const cat = byId.get(t.categoryId)
    return cat ? [{ tile: t, cat }] : []
  })
  // Studio picks lead; the row is topped up with remaining departments to six.
  const used = new Set(configured.map((x) => x.cat.id))
  const entries = [
    ...configured,
    ...departments.filter((c) => !used.has(c.id)).map((cat) => ({ tile: { categoryId: cat.id } as CategoryBannerTile, cat })),
  ].slice(0, 6)
  if (entries.length === 0) return null
  return (
    <section className={cn("container-page", className)} aria-labelledby="dept-row-title">
      {title ? (
        <SectionHeader id="dept-row-title" title={title} action={{ label: "All categories", to: "/categories" }} />
      ) : (
        // Tiles are h3s; keep the outline h1 → h2 → h3 without a visible heading.
        <h2 id="dept-row-title" className="sr-only">
          Shop by category
        </h2>
      )}
      <div className="rail -mx-4 px-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-6 lg:overflow-visible">
        {entries.map(({ tile, cat }) => (
          <CategoryTile
            key={cat.id}
            handle={cat.handle ?? cat.id}
            name={tile.label ?? cat.name}
            tagline={tile.eyebrow}
            imageUrl={tile.imageUrl}
            size="row"
            className="w-[42%] shrink-0 sm:w-[30%] lg:w-auto"
          />
        ))}
      </div>
    </section>
  )
}
