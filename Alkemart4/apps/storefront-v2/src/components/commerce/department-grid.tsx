import { useState } from "react"
import type { CategoryBannerTile } from "@alkemart/shared/homepage"
import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { DrinkIcon, Plant01Icon, Wrench01Icon } from "@hugeicons/core-free-icons"
import { DEPARTMENT_ICON } from "@/components/commerce/category-tile"
import { REFERENCE_DEPARTMENTS } from "@/components/home/reference-departments"
import { departmentFor } from "@/lib/departments"
import type { StoreCategory } from "@/lib/products"
import { cn } from "@/lib/utils"

/** Departments with a studio photo (/images/departments/reference-*); others show colour + glyph. */
const STUDIO: Record<string, string> = {
  electronics: "reference-electronics-v1",
  fashion: "reference-fashion-v2",
  home: "reference-home-v1",
  beauty: "reference-beauty-v1",
  gaming: "reference-gaming-v1",
  appliances: "reference-appliances-v1",
}

/** Departments that share a colour family still get their own glyph. */
const ICON_OVERRIDE: { re: RegExp; icon: typeof DrinkIcon }[] = [
  { re: /beverage|drink/, icon: DrinkIcon },
  { re: /agric|farm|garden/, icon: Plant01Icon },
  { re: /service|repair/, icon: Wrench01Icon },
]

/**
 * Phone department grid: three 4:5 tiles a row, name only (the studio photos
 * keep their top clear for it at 4:5). Used on the
 * home page (after the second product row) and the Categories page, so both
 * always look the same.
 */
export function DepartmentGrid({ departments, tiles = [], className, label = "Departments" }: {
  departments: StoreCategory[]
  /** Homepage-settings overrides (picture, label) per category. */
  tiles?: CategoryBannerTile[]
  className?: string
  label?: string
}) {
  if (departments.length === 0) return null
  const byCategory = new Map(tiles.map((t) => [t.categoryId, t]))
  return (
    <ul aria-label={label} className={cn("grid grid-cols-3 gap-2", className)}>
      {departments.map((c) => (
        <DepartmentTile key={c.id} cat={c} tile={byCategory.get(c.id)} />
      ))}
    </ul>
  )
}

function DepartmentTile({ cat, tile }: { cat: StoreCategory; tile?: CategoryBannerTile }) {
  const dept = departmentFor(cat.handle, cat.name)
  const key = `${cat.handle ?? ""} ${cat.name}`.toLowerCase()
  const icon = ICON_OVERRIDE.find((o) => o.re.test(key))?.icon ?? DEPARTMENT_ICON[dept.id]
  const studio = STUDIO[dept.id]
  const image = tile?.imageUrl ?? (studio ? `/images/departments/${studio}.webp` : null)
  const [broken, setBroken] = useState(false)
  const photo = Boolean(image) && !broken
  // Text colour follows whichever ground is showing: the photo's or the department's.
  const photoLight = REFERENCE_DEPARTMENTS.find((r) => r.id === dept.id)?.light
  // Admin pictures are unknown grounds: white text over a dark top scrim.
  const custom = photo && Boolean(tile?.imageUrl)
  const light = custom ? true : photo && photoLight != null ? photoLight : dept.tone === "light"
  return (
    <li>
      <Link
        to="/categories/$slug"
        params={{ slug: cat.handle ?? cat.id }}
        style={{ background: dept.ground }}
        className={cn(
          "relative isolate flex aspect-[4/5] flex-col overflow-hidden rounded-xl p-2 focus-visible:outline-2 focus-visible:outline-offset-2",
          light ? "text-white" : "text-foreground",
        )}
      >
        {photo ? (
          <img
            src={image!}
            alt=""
            width={900}
            height={1125}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="absolute inset-0 -z-10 size-full object-cover object-bottom"
          />
        ) : (
          <HugeiconsIcon icon={icon} aria-hidden className="absolute right-2 bottom-2 -z-10 size-9 opacity-80" />
        )}
        {custom ? <span aria-hidden className="absolute inset-x-0 top-0 -z-10 h-2/3 bg-gradient-to-b from-black/60 to-transparent" /> : null}
        <span className="line-clamp-2 text-[length:var(--text-legacy-13)] leading-tight font-bold">{tile?.label ?? cat.name}</span>
      </Link>
    </li>
  )
}
