import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, ArrowRight01Icon, ImageNotFound01Icon, Search01Icon, Tag01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ToneBadge } from "@workspace/console-ui/components/console/status-badge"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { formatMinor } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import type { Tone } from "@workspace/console-ui/lib/status"
import { listProducts, priceRange, shelfOf, stockOf, type Shelf, type VendorProduct } from "@/lib/products"

const SHELVES: { id: Shelf | "all"; label: string; tone: Tone }[] = [
  { id: "all", label: "All", tone: "neutral" },
  { id: "needs-changes", label: "Needs changes", tone: "warning" },
  { id: "draft", label: "Drafts", tone: "neutral" },
  { id: "in-review", label: "In review", tone: "info" },
  { id: "live", label: "Live", tone: "success" },
  { id: "low-stock", label: "Low stock", tone: "warning" },
  { id: "out-of-stock", label: "Out of stock", tone: "danger" },
]
const SHELF_LABEL = Object.fromEntries(SHELVES.map((s) => [s.id, s])) as Record<Shelf, (typeof SHELVES)[number]>

type Search = { status?: Shelf }
export const Route = createFileRoute("/_app/products/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    status: SHELVES.some((x) => x.id === s.status && x.id !== "all") ? (s.status as Shelf) : undefined,
  }),
  component: ProductsPage,
})

export const productsKey = ["products"] as const

function ProductsPage() {
  const { status } = Route.useSearch()
  const q = useQuery({ queryKey: productsKey, queryFn: listProducts, staleTime: 30_000 })
  const [term, setTerm] = useState("")
  const all = q.data ?? []
  const counts = new Map<string, number>()
  for (const p of all) counts.set(shelfOf(p), (counts.get(shelfOf(p)) ?? 0) + 1)
  const shown = all
    .filter((p) => !status || shelfOf(p) === status)
    .filter((p) => !term.trim() || p.product.title.toLowerCase().includes(term.trim().toLowerCase()))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        description="Everything you sell. Tap one to change price, stock or photos."
        actions={
          <Button asChild variant="brand" size="lg" className="hidden sm:inline-flex">
            <Link to="/products/new">
              <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" /> Add product
            </Link>
          </Button>
        }
      />

      {all.length > 0 ? (
        <div className="space-y-3">
          <nav aria-label="Filter products" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {SHELVES.map((s) => {
              const n = s.id === "all" ? all.length : (counts.get(s.id) ?? 0)
              if (s.id !== "all" && n === 0) return null
              const active = (status ?? "all") === s.id
              return (
                <Link
                  key={s.id}
                  to="/products"
                  search={s.id === "all" ? {} : { status: s.id as Shelf }}
                  replace
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap",
                    active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
                  )}
                >
                  {s.label}
                  <span className={cn("tabular", active ? "text-background/70" : "text-muted-foreground")}>{n}</span>
                </Link>
              )
            })}
          </nav>
          <label className="relative block">
            <span className="sr-only">Search your products</span>
            <HugeiconsIcon icon={Search01Icon} className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search your products" className="h-11 pl-11 text-base" />
          </label>
        </div>
      ) : null}

      {q.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState title="Your products didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Tag01Icon}
          title="Add your first product"
          description="Snap a photo, set a price and how many you have. It takes about a minute."
          action={
            <Button asChild variant="brand" size="xl">
              <Link to="/products/new">
                <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" /> Add product
              </Link>
            </Button>
          }
          className="rounded-2xl border bg-card py-12"
        />
      ) : shown.length === 0 ? (
        <EmptyState title="Nothing here" description={term ? `No products match “${term}”.` : "No products on this shelf."} className="rounded-2xl border bg-card" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <li key={p.product.id}>
              <ProductRow p={p} />
            </li>
          ))}
        </ul>
      )}

      {/* Thumb-reach primary action on phones, above the tab bar. */}
      <div className="fixed right-4 bottom-20 z-20 sm:hidden">
        <Button asChild variant="brand" size="xl" className="rounded-full shadow-lift">
          <Link to="/products/new">
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" /> Add product
          </Link>
        </Button>
      </div>
    </div>
  )
}

function ProductRow({ p }: { p: VendorProduct }) {
  const shelf = shelfOf(p)
  const [lo, hi] = priceRange(p)
  const stock = stockOf(p)
  const combos = p.variants.length
  const img = p.images[0]?.url ?? p.product.imageUrl
  return (
    <Link
      to="/products/$id"
      params={{ id: p.product.id }}
      className="flex h-full items-center gap-3.5 rounded-2xl border bg-card p-3 transition-colors hover:border-foreground/25"
    >
      <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface">
        {img ? (
          <img src={img} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <HugeiconsIcon icon={ImageNotFound01Icon} className="size-7 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="line-clamp-2 font-semibold leading-snug">{p.product.title}</span>
        <span className="block text-[15px] font-bold tabular">
          {lo === hi ? formatMinor(lo) : `${formatMinor(lo)} – ${formatMinor(hi)}`}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <ToneBadge tone={SHELF_LABEL[shelf].tone}>{shelf === "live" ? "Live" : SHELF_LABEL[shelf].label}</ToneBadge>
          <span className="tabular">{stock} in stock</span>
          {combos > 1 ? <span>· {combos} options</span> : null}
        </span>
      </span>
      <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
