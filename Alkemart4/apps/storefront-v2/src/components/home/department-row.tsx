import type { CategoryBannerTile } from "@alkemart/shared/homepage"
import { CategoryTile } from "@/components/commerce/category-tile"
import { SectionHeader } from "@/components/commerce/section-header"
import type { StoreCategory } from "@/lib/products"
import { cn } from "@/lib/utils"
import { SmartLink } from "@/components/commerce/smart-link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { referenceDepartmentHref, stockedReferenceDepartments } from "./reference-departments"

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
  allCategories = [],
  stocked = null,
}: {
  title?: string
  className?: string
  departments: StoreCategory[]
  tiles: CategoryBannerTile[]
  allCategories?: StoreCategory[]
  /** Categories with listings; null while unknown (show everything). */
  stocked?: Set<string> | null
}) {
  // An entry point with nothing behind it is a dead end: hide it once stock is known.
  const live = stocked ? departments.filter((c) => stocked.has(c.id)) : departments
  const reference = stockedReferenceDepartments(allCategories.length ? allCategories : departments, stocked)
  const byId = new Map(live.map((c) => [c.id, c]))
  const configured = tiles.flatMap((t) => {
    const cat = byId.get(t.categoryId)
    return cat ? [{ tile: t, cat }] : []
  })
  // Studio picks lead; the row is topped up with remaining departments to six.
  const used = new Set(configured.map((x) => x.cat.id))
  const entries = [
    ...configured,
    ...live.filter((c) => !used.has(c.id)).map((cat) => ({ tile: { categoryId: cat.id } as CategoryBannerTile, cat })),
  ].slice(0, 6)
  if (entries.length === 0 && reference.length === 0) return null
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
      <div className="rail -mx-4 px-4 sm:mx-0 sm:px-0 md:hidden">
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
      <div className={cn("hidden gap-3 md:grid md:grid-cols-3", reference.length > 3 ? "lg:grid-cols-6" : "lg:grid-cols-3")}>
        {reference.map(dept => (
          <SmartLink key={dept.id} href={referenceDepartmentHref(dept.id, allCategories.length ? allCategories : departments)} style={{ background: dept.ground }} className={cn("group relative isolate aspect-[4/5] overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand", dept.light ? "text-white" : "text-foreground")}>
            <img src={`/images/departments/reference-${dept.id}-${dept.id === "fashion" ? "v2" : "v1"}.webp`} alt="" width={900} height={1125} loading="lazy" className="absolute inset-0 size-full object-cover" />
            <div className="relative p-3 lg:p-4 xl:p-5">
              <h3 className="text-base leading-tight font-extrabold tracking-tight lg:text-lg xl:text-xl">{dept.title}</h3>
              <p className="mt-1 text-xs leading-snug xl:text-sm">{dept.tagline}</p>
            </div>
            <span aria-hidden="true" className="absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-white text-foreground shadow-sm transition-transform group-hover:translate-x-0.5"><HugeiconsIcon icon={ArrowRight01Icon} className="size-5" /></span>
          </SmartLink>
        ))}
      </div>
    </section>
  )
}
