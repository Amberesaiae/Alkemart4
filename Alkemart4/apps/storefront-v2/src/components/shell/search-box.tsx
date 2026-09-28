import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Command as CommandPrimitive } from "cmdk"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUpRight01Icon,
  Cancel01Icon,
  Clock01Icon,
  Search01Icon,
  Store04Icon,
} from "@hugeicons/core-free-icons"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { DEPARTMENT_ICON } from "@/components/commerce/category-tile"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import { useCategories } from "@/hooks/use-store"
import { useVendorDirectory } from "@/hooks/use-vendors"
import { searchCatalog } from "@/lib/search"
import { useSearchHistory } from "@/lib/search-history"
import { departmentFor } from "@/lib/departments"
import { formatMoney } from "@/lib/market"
import { productParam } from "@/lib/products"
import { trackSearchPerformed } from "@/lib/analytics"
import { cn } from "@/lib/utils"

/**
 * Header search with typeahead: recent searches (this device), matching
 * departments and shops from cached lists, and live product hits.
 * Enter always searches the typed text.
 */
export function SearchBox({
  className,
  initialQuery = "",
  autoFocus,
  placeholder = "Search products, brands or stores",
}: {
  className?: string
  initialQuery?: string
  autoFocus?: boolean
  placeholder?: string
}) {
  const navigate = useNavigate()
  const [q, setQ] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const deferred = useDeferredValue(q.trim())
  const { recent, trackSearch, removeQuery } = useSearchHistory()
  const categoriesQ = useCategories()
  const vendors = useVendorDirectory()

  const productsQ = useQuery({
    queryKey: ["store", "typeahead", deferred],
    queryFn: () => searchCatalog({ q: deferred, limit: 5 }),
    enabled: open && deferred.length >= 2,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const needle = deferred.toLowerCase()
  const departments = useMemo(() => {
    const top = (categoriesQ.data ?? []).filter((c) => !c.parentCategoryId)
    return (needle ? (categoriesQ.data ?? []).filter((c) => c.name.toLowerCase().includes(needle)) : top).slice(0, needle ? 4 : 6)
  }, [categoriesQ.data, needle])
  const shops = useMemo(
    () => (needle ? [...vendors.values()].filter((v) => v.name.toLowerCase().includes(needle)).slice(0, 3) : []),
    [vendors, needle],
  )
  const products = needle.length >= 2 ? (productsQ.data?.products ?? []) : []

  function go(query: string) {
    const term = query.trim()
    if (!term) return
    trackSearch(term)
    trackSearchPerformed(term)
    setOpen(false)
    void navigate({ to: "/search", search: { q: term } })
  }

  // Close when focus leaves the whole widget (not just the input).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [open])

  const hasPanel = open && (recent.length > 0 || departments.length > 0 || products.length > 0 || shops.length > 0)

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <Command shouldFilter={false} loop className="overflow-visible bg-transparent p-0">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            go(q)
          }}
          className="relative"
        >
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <CommandPrimitive.Input
            value={q}
            onValueChange={(v) => {
              setQ(v)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false)
              // Enter with nothing highlighted searches the typed text.
              if (e.key === "Enter" && !wrap.current?.querySelector("[cmdk-item][data-selected=true]")) {
                e.preventDefault()
                go(q)
              }
            }}
            autoFocus={autoFocus}
            placeholder={placeholder}
            aria-label="Search alkemart"
            enterKeyHint="search"
            className="h-12 w-full rounded-full border border-border bg-surface pr-12 pl-12 text-[length:var(--text-legacy-15)] outline-none placeholder:text-muted-foreground focus:border-foreground/30 focus:bg-background focus:shadow-lift"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </button>
          ) : null}
        </form>

        {hasPanel ? (
          <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-3xl border border-border bg-popover shadow-lift">
            <CommandList className="max-h-[min(70dvh,480px)] p-2">
              {!needle && recent.length > 0 ? (
                <CommandGroup heading="Recent">
                  {recent.map((term) => (
                    <CommandItem key={`r-${term}`} value={`recent:${term}`} onSelect={() => go(term)}>
                      <HugeiconsIcon icon={Clock01Icon} className="text-muted-foreground" />
                      <span className="flex-1 truncate">{term}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${term}`}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeQuery(term)
                        }}
                        className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                      </button>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {products.length > 0 ? (
                <CommandGroup heading="Products">
                  {products.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`product:${p.id}`}
                      onSelect={() => {
                        setOpen(false)
                        void navigate({ to: "/product/$id", params: { id: productParam(p) } })
                      }}
                    >
                      <span className="size-10 shrink-0 overflow-hidden rounded-xl bg-surface">
                        {p.thumbnail ? (
                          <img src={p.thumbnail} alt="" className="size-full object-contain p-1 mix-blend-multiply" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{p.title}</span>
                        <span className="text-xs text-muted-foreground tabular">
                          {(p.offerCount ?? 0) > 1 ? "From " : ""}
                          {formatMoney(p.amount, p.currencyCode)}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {departments.length > 0 ? (
                <CommandGroup heading={needle ? "Departments" : "Browse departments"}>
                  {departments.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`cat:${c.id}`}
                      onSelect={() => {
                        setOpen(false)
                        void navigate({ to: "/categories/$slug", params: { slug: c.handle ?? c.id } })
                      }}
                    >
                      <HugeiconsIcon icon={DEPARTMENT_ICON[departmentFor(c.handle, c.name).id]} />
                      <span className="flex-1 truncate">{c.name}</span>
                      <HugeiconsIcon icon={ArrowUpRight01Icon} className="text-muted-foreground" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {shops.length > 0 ? (
                <CommandGroup heading="Stores">
                  {shops.map((s) => (
                    <CommandItem
                      key={s.slug}
                      value={`shop:${s.slug}`}
                      onSelect={() => {
                        setOpen(false)
                        void navigate({ to: "/shops/$slug", params: { slug: s.slug } })
                      }}
                    >
                      <SellerAvatar name={s.name} logo={s.logo} size="sm" />
                      <span className="flex-1 truncate">{s.name}</span>
                      <HugeiconsIcon icon={Store04Icon} className="text-muted-foreground" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {needle ? (
                <CommandItem value={`search:${needle}`} onSelect={() => go(q)} className="mt-1 font-semibold">
                  <HugeiconsIcon icon={Search01Icon} />
                  Search for “{q.trim()}”
                </CommandItem>
              ) : null}
            </CommandList>
          </div>
        ) : null}
      </Command>
    </div>
  )
}
