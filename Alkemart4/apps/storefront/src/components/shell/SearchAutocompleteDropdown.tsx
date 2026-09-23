import { useState, useEffect, useRef, useMemo } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  MagnifyingGlass,
  ClockCounterClockwise,
  Storefront,
  X,
  ArrowRight,
  DeviceMobile,
  ShoppingCartSimple,
  TShirt,
  Heart,
  House,
  Baby,
} from "@phosphor-icons/react"
import { searchCatalog } from "@/lib/search"
import type { StoreProductCard } from "@/lib/products"
import { cn } from "@/lib/utils"

export const RECENT_SEARCHES_KEY = "alkemart_recent_searches"
const MAX_RECENT = 6

export function getStoredRecentSearches(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, MAX_RECENT)
      : []
  } catch {
    return []
  }
}

export function saveStoredRecentSearch(query: string): string[] {
  if (typeof window === "undefined") return []
  const clean = query.trim()
  if (!clean) return getStoredRecentSearches()
  try {
    const existing = getStoredRecentSearches().filter((s) => s.toLowerCase() !== clean.toLowerCase())
    const next = [clean, ...existing].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
    return next
  } catch {
    return []
  }
}

export function removeStoredRecentSearch(target: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const existing = getStoredRecentSearches().filter((s) => s.toLowerCase() !== target.toLowerCase())
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(existing))
    return existing
  } catch {
    return []
  }
}

export function clearStoredRecentSearches(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch {
    // Ignore storage errors
  }
}

export const POPULAR_CATEGORIES = [
  { label: "Phones & Electronics", slug: "phones-electronics", icon: DeviceMobile },
  { label: "Food & Groceries", slug: "food-groceries", icon: ShoppingCartSimple },
  { label: "Fashion & Apparel", slug: "fashion-apparel", icon: TShirt },
  { label: "Health & Beauty", slug: "health-beauty", icon: Heart },
  { label: "Home & Living", slug: "home-living", icon: House },
  { label: "Baby & Kids", slug: "baby-kids", icon: Baby },
]

export const POPULAR_STORES = [
  { name: "Melcom Superstore", location: "Accra Central", handle: "melcom" },
  { name: "Shoprite Grocery", location: "Accra Mall", handle: "shoprite" },
  { name: "Hisense Store", location: "Spintex Road", handle: "hisense" },
]

export interface SearchAutocompleteDropdownProps {
  isOpen: boolean
  query: string
  onClose: () => void
  onSelectQuery: (q: string) => void
  onSelectCategory?: (slug: string) => void
}

export function SearchAutocompleteDropdown({
  isOpen,
  query,
  onClose,
  onSelectQuery,
  onSelectCategory,
}: SearchAutocompleteDropdownProps) {
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    isOpen ? getStoredRecentSearches() : [],
  )
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  // Sync recent searches from localStorage whenever dropdown opens
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getStoredRecentSearches())
    }
  }, [isOpen])

  // Debounce typing to prevent excessive API hits
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const cleanQuery = debouncedQuery.trim()
  const isTyping = cleanQuery.length > 0

  // Live instant products query when typing
  const liveResultsQ = useQuery({
    queryKey: ["search", "autocomplete", cleanQuery],
    queryFn: () => searchCatalog({ q: cleanQuery, limit: 4 }),
    enabled: isOpen && isTyping,
    staleTime: 30_000,
  })

  const liveProducts: StoreProductCard[] = useMemo(() => {
    return liveResultsQ.data?.products?.slice(0, 4) ?? []
  }, [liveResultsQ.data])

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("pointerdown", onPointerDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("pointerdown", onPointerDown)
    }
  }, [isOpen, onClose])

  function handleRemoveRecent(e: React.MouseEvent, item: string) {
    e.stopPropagation()
    e.preventDefault()
    const updated = removeStoredRecentSearch(item)
    setRecentSearches(updated)
  }

  function handleClearAllRecent(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    clearStoredRecentSearches()
    setRecentSearches([])
  }

  function handleExecuteSearch(targetQuery: string) {
    saveStoredRecentSearch(targetQuery)
    onSelectQuery(targetQuery)
    onClose()
    navigate({ to: "/search", search: { q: targetQuery } })
  }

  function handleSelectCategory(slug: string) {
    onClose()
    if (onSelectCategory) {
      onSelectCategory(slug)
    } else {
      navigate({ to: "/categories/$slug", params: { slug } })
    }
  }

  function handleSelectStore(handle: string) {
    onClose()
    navigate({ to: "/shops/$slug", params: { slug: handle } })
  }

  if (!isOpen) return null

  return (
    <>
      {/* Subtle backdrop overlay for focus */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[0.5px] transition-opacity animate-in fade-in duration-150"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Main Dropdown Panel - Simple, clean, unpretentious */}
      <div
        ref={dropdownRef}
        role="dialog"
        aria-label="Search suggestions"
        className={cn(
          "absolute left-0 right-0 top-full mt-2 z-50",
          "w-full overflow-hidden",
          "rounded-2xl border border-border/80 bg-card text-card-foreground shadow-xl",
          "animate-in fade-in-50 zoom-in-98 duration-150",
          "max-h-[80vh] overflow-y-auto scrollbar-none",
        )}
      >
        {!isTyping ? (
          /* ========================================================= */
          /* STATE A: IDLE / RECENT SEARCHES (Accumulates with time)   */
          /* ========================================================= */
          <div className="p-4 sm:p-5 space-y-5">
            {/* 1. Buyer's Search History (Accumulates with time) */}
            {recentSearches.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">Recent Searches</span>
                  <button
                    type="button"
                    onClick={handleClearAllRecent}
                    className="hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="divide-y divide-border/40">
                  {recentSearches.map((item) => (
                    <div
                      key={item}
                      className="group flex items-center justify-between py-2 text-sm text-foreground hover:text-primary transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleExecuteSearch(item)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                      >
                        <ClockCounterClockwise size={15} className="text-muted-foreground shrink-0" />
                        <span className="truncate font-medium">{item}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${item}`}
                        onClick={(e) => handleRemoveRecent(e, item)}
                        className="text-muted-foreground/60 hover:text-foreground p-1 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* 2. Popular Categories */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Departments
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {POPULAR_CATEGORIES.map((cat) => {
                  const IconComp = cat.icon
                  return (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => handleSelectCategory(cat.slug)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-medium text-foreground",
                        "hover:bg-muted/70 transition-colors",
                      )}
                    >
                      <IconComp size={16} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 3. Popular Stores */}
            <div className="space-y-2 pt-3 border-t border-border/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Stores
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {POPULAR_STORES.map((store) => (
                  <button
                    key={store.handle}
                    type="button"
                    onClick={() => handleSelectStore(store.handle)}
                    className="flex items-center gap-2.5 rounded-xl p-2 text-left hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Storefront size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{store.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{store.location}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* STATE B: ACTIVE TYPING (HONEST INSTANT SEARCH)            */
          /* ========================================================= */
          <div className="p-4 space-y-4">
            {/* 1. Direct Search Query Trigger */}
            <button
              type="button"
              onClick={() => handleExecuteSearch(cleanQuery)}
              className="flex w-full items-center justify-between rounded-xl p-2.5 text-left hover:bg-muted transition-colors text-foreground group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <MagnifyingGlass size={16} className="text-muted-foreground shrink-0" />
                <span className="truncate text-sm">
                  Search for <strong>&ldquo;{cleanQuery}&rdquo;</strong>
                </span>
              </div>
              <ArrowRight size={14} className="text-muted-foreground group-hover:text-foreground shrink-0" />
            </button>

            {/* 2. Instant Matching Products */}
            {liveProducts.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Products
                </span>
                <div className="divide-y divide-border/40">
                  {liveProducts.map((prod) => {
                    const priceFormatted =
                      prod.amount != null
                        ? `GH₵ ${Number(prod.amount).toFixed(2)}`
                        : "Contact Seller"
                    const thumb = prod.thumbnail || prod.thumbUrl || "/images/placeholder-product.svg"

                    return (
                      <Link
                        key={prod.id}
                        to="/product/$id"
                        params={{ id: prod.slug?.trim() ? `${prod.slug.trim()}-${prod.id}` : prod.id }}
                        onClick={onClose}
                        className="flex items-center gap-3 py-2.5 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors group"
                      >
                        <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-muted border border-border/60">
                          <img
                            src={thumb}
                            alt={prod.title}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {prod.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span className="font-bold text-foreground">{priceFormatted}</span>
                            {prod.seller?.name && (
                              <span className="truncate">• {prod.seller.name}</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ) : !liveResultsQ.isLoading ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                Press Enter to search all results for &ldquo;{cleanQuery}&rdquo;
              </div>
            ) : null}

            {/* 3. Bottom Action */}
            <div className="pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => handleExecuteSearch(cleanQuery)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground text-background py-2.5 text-xs font-bold hover:opacity-90 transition-opacity"
              >
                <span>View all results for &ldquo;{cleanQuery}&rdquo;</span>
                <ArrowRight size={14} weight="bold" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
