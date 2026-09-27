import { useMemo, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, DrinkIcon, Plant01Icon } from "@hugeicons/core-free-icons"
import { MARKET_DEPARTMENT_ORDER } from "@alkemart/shared/homepage"
import { Skeleton } from "@/components/ui/skeleton"
import { DEPARTMENT_ICON } from "@/components/commerce/category-tile"
import { ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { useCategories } from "@/hooks/use-store"
import { departmentFor } from "@/lib/departments"
import type { StoreCategory } from "@/lib/products"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/categories/")({
  component: CategoriesPage,
})

type Dept = { cat: StoreCategory; kids: StoreCategory[] }

/**
 * The category directory: every department with its sub-categories one tap
 * away. Finding by name is the header search's job (it suggests categories,
 * shops and products as you type) — one search box, not two. Phones get
 * compact rows (≈5 departments per screen, not one); wide screens get a
 * directory grid.
 */
function CategoriesPage() {
  const q = useCategories()
  const depts = useMemo<Dept[]>(() => {
    const all = q.data ?? []
    const order = MARKET_DEPARTMENT_ORDER as readonly string[]
    const idx = (h?: string | null) => {
      const i = order.indexOf((h ?? "").toLowerCase())
      return i === -1 ? 100 : i
    }
    return all
      .filter((c) => !c.parentCategoryId)
      .sort((a, b) => idx(a.handle) - idx(b.handle) || (a.rank ?? 0) - (b.rank ?? 0))
      .map((cat) => ({ cat, kids: all.filter((k) => k.parentCategoryId === cat.id).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)) }))
  }, [q.data])

  const subCount = depts.reduce((n, d) => n + d.kids.length, 0)

  return (
    <div className="container-page space-y-6 pt-5 pb-10 sm:space-y-8 sm:pt-8">
      <PageSeo title="All categories" description="Every department on alkemart — find the right category in one tap." path="/categories" />

      <header className="space-y-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Shop by category</h1>
          <p className="mt-1 text-muted-foreground">
            {depts.length ? `${depts.length} departments · ${subCount} categories` : "Every department in one place"}
          </p>
        </div>
        {/* Jump strip: every department as a chip, for quick scanning on phones. */}
        {depts.length ? (
          <nav aria-label="Jump to a department" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 lg:hidden">
            {depts.map((d) => (
              <a key={d.cat.id} href={`#dept-${d.cat.handle ?? d.cat.id}`} className="shrink-0 rounded-full border border-border bg-background px-3.5 py-2 text-sm font-semibold whitespace-nowrap hover:bg-muted">
                {d.cat.name}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}

      {q.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : (
        <ul className="grid gap-3 sm:gap-4 lg:grid-cols-3">
          {depts.map((d) => (
            <DeptCard key={d.cat.id} d={d} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Department scenes that exist in /public/images/departments (others use the glyph — no failed request). */
const HAS_ART = new Set(["appliances", "beauty", "electronics", "fashion", "gaming", "home"])

/** Departments that share a colour family still get their own glyph. */
const ICON_OVERRIDE: { re: RegExp; icon: typeof DrinkIcon }[] = [
  { re: /beverage|drink/, icon: DrinkIcon },
  { re: /agric|farm|garden/, icon: Plant01Icon },
]

function DeptThumb({ cat, size }: { cat: StoreCategory; size: "sm" | "lg" }) {
  const dept = departmentFor(cat.handle, cat.name)
  const key = `${cat.handle ?? ""} ${cat.name}`.toLowerCase()
  const icon = ICON_OVERRIDE.find((o) => o.re.test(key))?.icon ?? DEPARTMENT_ICON[dept.id]
  const [broken, setBroken] = useState(!HAS_ART.has(dept.id))
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center overflow-hidden", size === "lg" ? "size-16 rounded-2xl sm:size-20" : "size-11 rounded-xl")}
      style={{ background: dept.ground }}
      aria-hidden
    >
      {!broken ? (
        <img src={dept.cutout} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="absolute inset-0 size-full object-cover object-bottom" />
      ) : (
        <HugeiconsIcon icon={icon} className={cn(size === "lg" ? "size-8" : "size-5", dept.tone === "light" ? "text-white" : "text-foreground")} />
      )}
    </span>
  )
}

function DeptCard({ d }: { d: Dept }) {
  const slug = d.cat.handle ?? d.cat.id
  const shown = d.kids.slice(0, 8)
  const more = d.kids.length - shown.length
  return (
    <li id={`dept-${slug}`} className="scroll-mt-24 rounded-3xl border border-border bg-card p-3.5 sm:p-4">
      <Link to="/categories/$slug" params={{ slug }} className="group flex items-center gap-3.5">
        <DeptThumb cat={d.cat} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block text-lg leading-tight font-extrabold group-hover:underline group-hover:underline-offset-4">{d.cat.name}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{d.kids.length ? `${d.kids.length} categories` : "Shop all"}</span>
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface group-hover:bg-foreground group-hover:text-background" aria-hidden>
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </span>
      </Link>
      {shown.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {shown.map((k) => (
            <li key={k.id}>
              <Link to="/categories/$slug" params={{ slug: k.handle ?? k.id }} className="inline-flex min-h-9 items-center rounded-full bg-surface px-3.5 text-sm font-medium hover:bg-muted">
                {k.name}
              </Link>
            </li>
          ))}
          {more > 0 ? (
            <li>
              <Link to="/categories/$slug" params={{ slug }} className="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold underline-offset-4 hover:underline">
                +{more} more
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  )
}
