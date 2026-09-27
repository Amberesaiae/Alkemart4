import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  BabyBottleIcon,
  BlenderIcon,
  Book02Icon,
  Car01Icon,
  CatIcon,
  Dumbbell01Icon,
  GameController01Icon,
  GridViewIcon,
  Medicine01Icon,
  PerfumeIcon,
  ShoppingBasket01Icon,
  SmartPhone01Icon,
  Sofa01Icon,
  TShirtIcon,
} from "@hugeicons/core-free-icons"
import { departmentFor, type Department, type DepartmentId } from "@/lib/departments"
import { cn } from "@/lib/utils"

export const DEPARTMENT_ICON: Record<DepartmentId, IconSvgElement> = {
  electronics: SmartPhone01Icon,
  fashion: TShirtIcon,
  home: Sofa01Icon,
  beauty: PerfumeIcon,
  gaming: GameController01Icon,
  appliances: BlenderIcon,
  baby: BabyBottleIcon,
  food: ShoppingBasket01Icon,
  health: Medicine01Icon,
  pets: CatIcon,
  sports: Dumbbell01Icon,
  auto: Car01Icon,
  books: Book02Icon,
  default: GridViewIcon,
}

/**
 * Art chain, first that loads wins: admin studio art → department scene
 * (/images/departments/{id}.webp) → glyph on the department colour. A missing
 * file just advances the chain, so new art ships without a code change.
 * The old shared category photos are deliberately not used: they were not
 * composed for a title on top, and tiles carry plain text with no overlay.
 * `object-cover` + bottom anchor: never stretch, and the products (which sit
 * low in every scene) survive any crop.
 */
function DepartmentArt({ dept, overrideSrc }: { dept: Department; overrideSrc?: string | null }) {
  const sources = [overrideSrc, dept.cutout].filter((s): s is string => Boolean(s))
  const [index, setIndex] = useState(0)
  const src = sources[index]
  if (src) {
    return (
      <img
        key={src}
        src={src}
        alt=""
        loading="lazy"
        onError={() => setIndex((i) => i + 1)}
        className="pointer-events-none absolute inset-0 size-full object-cover object-bottom transition-transform duration-500 group-hover/tile:scale-[1.04]"
      />
    )
  }
  return (
    <HugeiconsIcon
      icon={DEPARTMENT_ICON[dept.id]}
      aria-hidden
      className="pointer-events-none absolute right-5 bottom-5 size-24 opacity-25"
      strokeWidth={1.2}
    />
  )
}

export function CategoryTile({
  handle,
  name,
  tagline,
  imageUrl,
  size = "standard",
  className,
}: {
  handle: string
  name: string
  tagline?: string | null
  /** Admin-configured banner art (homepage studio) overrides department art. */
  imageUrl?: string | null
  /** `row`: tall tile for the single-row category strip (art along the bottom). */
  size?: "feature" | "standard" | "row"
  className?: string
}) {
  const dept = departmentFor(handle, name)
  const light = dept.tone === "light"
  return (
    <Link
      to="/categories/$slug"
      params={{ slug: handle }}
      className={cn(
        "group/tile relative isolate flex overflow-hidden rounded-3xl",
        size === "feature" ? "min-h-64 sm:min-h-72" : size === "row" ? "aspect-[4/5] lg:aspect-[20/21]" : "min-h-52 sm:min-h-60",
        className,
      )}
      style={{ background: dept.ground }}
    >
      <DepartmentArt dept={dept} overrideSrc={imageUrl} />
      <div className={cn("relative z-10 p-4 sm:p-5", size === "row" ? "max-w-full p-4 xl:p-5" : "sm:max-w-[62%] sm:p-6", size === "feature" ? "max-w-[70%]" : "max-w-full", light ? "text-white" : "text-foreground")}>
        <h3 className={cn("font-extrabold leading-[1] text-balance", size === "feature" ? "text-3xl sm:text-4xl" : size === "row" ? "text-xl tracking-[-0.035em] sm:text-[1.4rem] lg:text-[1.35rem] xl:text-2xl" : "text-lg sm:text-2xl")}>
          {name}
        </h3>
        {/* Row tiles are title-only: at ~200px wide a tagline always lands on the art. */}
        {size !== "row" ? (
          <p className={cn("mt-1.5 text-xs leading-snug font-medium sm:mt-2 sm:text-sm", light ? "text-white/90" : "text-foreground/80")}>
            {tagline ?? dept.tagline}
          </p>
        ) : null}
      </div>
      <span
        aria-hidden
        className={cn(
          "absolute bottom-4 z-10 grid size-10 place-items-center rounded-full bg-white text-foreground shadow-sm sm:size-11",
          size === "row" ? "right-4" : "left-4 sm:bottom-6 sm:left-6",
        )}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" />
      </span>
    </Link>
  )
}

/** Compact pill for the long tail of departments (bottom row of the mosaic). */
export function CategoryPill({ handle, name }: { handle: string; name: string }) {
  const dept = departmentFor(handle, name)
  return (
    <Link
      to="/categories/$slug"
      params={{ slug: handle }}
      className="group/pill flex min-h-16 items-center gap-3 rounded-full bg-surface py-2 pr-3 pl-2 hover:bg-muted"
    >
      <span
        className="grid size-12 shrink-0 place-items-center rounded-full"
        style={{ background: dept.ground }}
      >
        <HugeiconsIcon
          icon={DEPARTMENT_ICON[dept.id]}
          className={cn("size-6", dept.tone === "light" ? "text-white" : "text-foreground")}
        />
      </span>
      <span className="line-clamp-2 flex-1 text-sm leading-tight font-semibold">{name}</span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="size-4 shrink-0 text-muted-foreground"
      />
    </Link>
  )
}
