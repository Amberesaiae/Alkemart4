import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
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
import { listStoreProducts, type StoreCategory } from "@/lib/products"
import { stockedCategories } from "@/components/home/discovery"
import { REFERENCE_DEPARTMENTS } from "@/components/home/reference-departments"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/categories/")({
  component: CategoriesPage,
})

type Dept = { cat: StoreCategory; kids: StoreCategory[] }

/**
 * The category directory: every department with its sub-categories one tap
 * away. Finding by name is the header search's job (it suggests categories,
 * shops and products as you type) — one search box, not two. Phones get a
 * two-column grid of photo tiles (departments with listings only, once
 * known); a tile opens the department, whose page lists its sub-categories.
 * Wide screens get the directory with sub-categories inline.
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
  // Same query as the homepage's discovery rows, so it's usually cached.
  const catalogQ = useQuery({
    queryKey: ["store", "discovery", "catalog"],
    queryFn: () => listStoreProducts({ limit: 96, sort: "newest" }),
    staleTime: 300_000,
  })
  const stocked = catalogQ.data && q.data?.length ? stockedCategories(catalogQ.data.products, q.data) : null
  const phoneDepts = stocked ? depts.filter((d) => stocked.has(d.cat.id)) : depts

  return (
    <div className="container-page space-y-6 pt-5 pb-10 sm:space-y-8 sm:pt-8">
      <PageSeo title="All categories" description="Every department on alkemart — find the right category in one tap." path="/categories" />

      <header className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">Shop by category</h1>
          <p className="mt-1 hidden text-muted-foreground md:block">
            {depts.length ? `${depts.length} departments · ${subCount} categories` : "Every department in one place"}
          </p>
        </div>
        {/* Jump strip: every department as a chip, for quick scanning on phones. */}
        {depts.length ? (
          <nav aria-label="Jump to a department" className="hidden flex-wrap gap-2 md:flex lg:hidden">
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
        <>
          <ul aria-label="Departments" className="grid grid-cols-2 gap-3 md:hidden">
            {phoneDepts.map((d) => (
              <DeptPhotoTile key={d.cat.id} cat={d.cat} />
            ))}
          </ul>
          <ul className="hidden gap-4 md:grid lg:grid-cols-3">
            {depts.map((d) => (
              <DeptCard key={d.cat.id} d={d} />
            ))}
          </ul>
        </>
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

/** Departments with a studio photo (/images/departments/reference-*). */
const STUDIO: Record<string, string> = {
  electronics: "reference-electronics-v1",
  fashion: "reference-fashion-v2",
  home: "reference-home-v1",
  beauty: "reference-beauty-v1",
  gaming: "reference-gaming-v1",
  appliances: "reference-appliances-v1",
}

/** Phone tile: name and one line on the department's own ground, photo behind. */
function DeptPhotoTile({ cat }: { cat: StoreCategory }) {
  const dept = departmentFor(cat.handle, cat.name)
  const key = `${cat.handle ?? ""} ${cat.name}`.toLowerCase()
  const icon = ICON_OVERRIDE.find((o) => o.re.test(key))?.icon ?? DEPARTMENT_ICON[dept.id]
  const studio = STUDIO[dept.id]
  const [broken, setBroken] = useState(false)
  // Text colour follows whichever ground is showing: the photo's, or the department's.
  const photoLight = REFERENCE_DEPARTMENTS.find((r) => r.id === dept.id)?.light
  const light = studio && !broken && photoLight != null ? photoLight : dept.tone === "light"
  return (
    <li>
      <Link
        to="/categories/$slug"
        params={{ slug: cat.handle ?? cat.id }}
        style={{ background: dept.ground }}
        className={cn("relative isolate flex aspect-[4/5] flex-col overflow-hidden rounded-2xl p-3", light ? "text-white" : "text-foreground")}
      >
        {studio && !broken ? (
          <img src={`/images/departments/${studio}.webp`} alt="" width={900} height={1125} loading="lazy" decoding="async" onError={() => setBroken(true)} className="absolute inset-0 -z-10 size-full object-cover" />
        ) : (
          <HugeiconsIcon icon={icon} aria-hidden className="absolute right-3 bottom-3 -z-10 size-16 opacity-80" />
        )}
        <span className="text-base leading-tight font-extrabold">{cat.name}</span>
        <span className="mt-0.5 line-clamp-2 text-xs leading-snug opacity-90">{dept.tagline}</span>
      </Link>
    </li>
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
