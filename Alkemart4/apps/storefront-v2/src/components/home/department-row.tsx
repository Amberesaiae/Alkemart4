import { useId } from "react"
import { SectionHeader } from "@/components/commerce/section-header"
import type { StoreCategory } from "@/lib/products"
import { cn } from "@/lib/utils"
import { SmartLink } from "@/components/commerce/smart-link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { REFERENCE_DEPARTMENTS, referenceDepartmentHref } from "./reference-departments"

/**
 * Desktop department tiles under the hero (phones use DepartmentGrid further
 * down the page instead).
 */
export function DepartmentRow({
  title,
  departments,
  className,
  allCategories = [],
}: {
  title?: string
  className?: string
  departments: StoreCategory[]
  allCategories?: StoreCategory[]
}) {
  const headingId = useId()
  return (
    <section className={cn("container-page hidden md:block", className)} aria-labelledby={headingId}>
      {title ? (
        <SectionHeader id={headingId} title={title} action={{ label: "All categories", to: "/categories" }} />
      ) : (
        // Tiles are h3s; keep the outline h1 → h2 → h3 without a visible heading.
        <h2 id={headingId} className="sr-only">
          Shop by category
        </h2>
      )}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {REFERENCE_DEPARTMENTS.map(dept => (
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
