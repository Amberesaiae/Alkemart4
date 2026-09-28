import { useState } from "react"
import type { CategoryBannerTile } from "@alkemart/shared/homepage"
import { categoryArtFor } from "@alkemart/shared/category-art"
import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { CustomerService01Icon, DrinkIcon, HammerIcon, Package01Icon, Plant01Icon } from "@hugeicons/core-free-icons"
import { DEPARTMENT_ICON } from "@/components/commerce/category-tile"
import { departmentFor } from "@/lib/departments"
import { departmentArtFor } from "@/lib/department-art"
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
  { re: /tool|hardware/, icon: HammerIcon },
  { re: /service|repair/, icon: CustomerService01Icon },
  // The grid glyph means "All"; Other gets its own.
  { re: /^\s*other\b|\bother\s*$/, icon: Package01Icon },
]

/**
 * Phone department grid: two a row, a portrait picture with the name under
 * it — never on it, so no name sits on a product or depends on a photo's
 * colours. The full studio scene fits its original 4:5 frame without cropping
 * the subject. Names reserve two lines so rows align. Used on the
 * Categories page. Home uses a compact three-column preview with the same
 * uncropped artwork and label treatment.
 */
export function DepartmentGrid({ departments, tiles = [], className, label = "Departments", compact = false }: {
  departments: StoreCategory[]
  /** Homepage-settings overrides (picture, label) per category. */
  tiles?: CategoryBannerTile[]
  className?: string
  label?: string
  compact?: boolean
}) {
  if (departments.length === 0) return null
  const byCategory = new Map(tiles.map((t) => [t.categoryId, t]))
  return (
    <ul aria-label={label} className={cn("grid gap-x-3 gap-y-4", compact ? "grid-cols-3" : "grid-cols-2", className)}>
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
  const canonical = categoryArtFor(cat.handle)
  const directoryArt = departmentArtFor(cat.handle)
  const image = tile?.imageUrl ?? directoryArt ?? (studio ? `/images/departments/${studio}.webp` : canonical?.photo)
  const [broken, setBroken] = useState(false)
  const photo = Boolean(image) && !broken
  return (
    <li>
      <Link
        to="/categories/$slug"
        params={{ slug: cat.handle ?? cat.id }}
        className="group flex flex-col gap-1.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span
          className={cn("grid aspect-[4/5] place-items-center overflow-hidden rounded-xl", !photo && "ring-1 ring-foreground/5 ring-inset")}
          // Photos sit on their own colour; icon tiles take a soft tint so they recede until they get
          // art. The neutral default is already pale, so it takes the surface grey instead.
          style={{ background: photo ? dept.ground : dept.id === "default" ? "var(--muted)" : `color-mix(in srgb, ${dept.ground} 20%, white)` }}
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
              className={cn("size-full", tile?.imageUrl || studio || directoryArt ? "object-contain object-center" : cn("object-cover", canonical?.objectPos))}
            />
          ) : (
            // Strong grounds colour the icon; pale ones (yellow, grey) would vanish on their own tint.
            <HugeiconsIcon icon={icon} aria-hidden className="size-14" style={{ color: dept.tone === "light" ? dept.ground : "var(--foreground)" }} />
          )}
        </span>
        <span className="line-clamp-2 min-h-[2lh] text-center text-sm leading-tight font-semibold">
          {tile?.label ?? cat.name}
        </span>
      </Link>
    </li>
  )
}
