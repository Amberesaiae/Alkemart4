import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Storefront } from "@phosphor-icons/react"
import { DEFAULT_STORE_CATEGORIES, listStoreCategories } from "@/lib/products"
import { iconForCategory, resolveRailCategories } from "@/lib/catalog-nav"
import { IconSafe } from "@/design/icons"
import { cn } from "@/lib/utils"
import {
  MEGA_TAXONOMY,
  type MegaDepartmentData,
} from "@/lib/mega-taxonomy"

export function HeaderCategoryNav({ pathname }: { pathname: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [headerBottom, setHeaderBottom] = useState<number>(140)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const categoriesQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    staleTime: 5 * 60_000,
  })

  const categories = useMemo(
    () =>
      resolveRailCategories(
        (categoriesQ.data?.length ?? 0) > 0
          ? categoriesQ.data!
          : DEFAULT_STORE_CATEGORIES,
      ),
    [categoriesQ.data],
  )

  const activeDept: MegaDepartmentData | null = useMemo(() => {
    if (!hoveredSlug) return null
    const fromTaxonomy = MEGA_TAXONOMY[hoveredSlug]
    if (fromTaxonomy) return fromTaxonomy

    // Fallback if not found in MEGA_TAXONOMY
    const cat = categories.find((c) => (c.handle || c.id).toLowerCase() === hoveredSlug)
    if (!cat) return null

    const children = cat.children ?? []
    return {
      title: cat.name,
      columns: [
        {
          sections: [
            {
              title: "CATEGORIES",
              items: children.slice(0, 6).map((ch) => ({ label: ch.name, handle: ch.handle })),
            },
          ],
        },
        {
          sections: [
            {
              title: "FEATURED",
              items: children.slice(6, 12).map((ch) => ({ label: ch.name, handle: ch.handle })),
            },
          ],
        },
      ],
      sections: [],
    }
  }, [hoveredSlug, categories])

  function updateHeaderBottom() {
    if (typeof document === "undefined") return
    const header = document.querySelector("header[role='banner']")
    if (header) {
      const rect = header.getBoundingClientRect()
      setHeaderBottom(rect.bottom)
    }
  }

  function handleCategoryEnter(slug: string) {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    updateHeaderBottom()
    setHoveredSlug(slug)
  }

  function handleCategoryLeave() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = setTimeout(() => {
      setHoveredSlug(null)
    }, 150)
  }

  function handleMenuEnter() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function handleMenuLeave() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = setTimeout(() => {
      setHoveredSlug(null)
    }, 150)
  }

  // Close on route change
  useEffect(() => {
    setHoveredSlug(null)
  }, [pathname])

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setHoveredSlug(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <nav className="flex min-w-0 flex-1 items-center" aria-label="Departments and stores">
      <div ref={scrollRef} className="scrollbar-none min-w-0 flex-1 overflow-x-auto scroll-smooth">
        <div className="flex w-max items-center gap-1 sm:gap-1.5 pr-2">
          {/* Official Stores (Jumia leading rail pattern) */}
          <Link
            to="/shops"
            onClick={() => setHoveredSlug(null)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs sm:text-[13px] font-semibold",
              pathname.startsWith("/shops")
                ? "bg-muted text-foreground font-bold"
                : "text-foreground/90 hover:bg-muted/60 hover:text-foreground",
            )}
            aria-current={pathname.startsWith("/shops") ? "page" : undefined}
          >
            <Storefront size={16} weight="bold" className="text-primary shrink-0" />
            <span>Official Stores</span>
          </Link>

          {/* Department Category Chips with Refined Typography Hierarchy */}
          {categories.map((category) => {
            const slug = (category.handle || category.id).toLowerCase()
            const active = pathname.startsWith(`/categories/${slug}`)
            const isHovered = hoveredSlug === slug
            return (
              <Link
                key={category.id}
                to="/categories/$slug"
                params={{ slug }}
                onMouseEnter={() => handleCategoryEnter(slug)}
                onMouseLeave={handleCategoryLeave}
                onClick={() => setHoveredSlug(null)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs sm:text-[13px]",
                  active || isHovered
                    ? "bg-muted text-foreground font-bold shadow-2xs"
                    : "text-muted-foreground font-medium sm:font-semibold hover:bg-muted/60 hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <IconSafe
                  name={iconForCategory(category.name, category.handle)}
                  size={16}
                  preferAsset
                  className={cn(
                    "shrink-0",
                    active || isHovered ? "text-foreground" : "text-muted-foreground/80",
                  )}
                />
                <span>{category.name}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Jumia-grade Hover Mega Menu Dropdown */}
      {hoveredSlug && activeDept ? (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-x-0 bottom-0 z-40 bg-black/25 backdrop-blur-[0.5px]"
            style={{ top: headerBottom }}
            onClick={() => setHoveredSlug(null)}
            aria-hidden="true"
          />

          {/* Mega Menu Dropdown Panel */}
          <div
            className="absolute left-0 right-0 top-full z-50 border-b border-border/80 bg-card shadow-2xl"
            onMouseEnter={handleMenuEnter}
            onMouseLeave={handleMenuLeave}
            role="region"
            aria-label={`${activeDept.title} menu`}
          >
            <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-6">
              {/* Columns Grid matching Jumia layout */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {activeDept.columns.map((column, colIdx) => (
                  <div key={colIdx} className="space-y-6">
                    {column.sections.map((section, secIdx) => (
                      <div key={secIdx} className="space-y-2">
                        <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-foreground pb-1.5 border-b border-border/60">
                          {section.title}
                        </h3>
                        <ul className="space-y-1">
                          {section.items.map((item, itemIdx) => {
                            if (item.searchQuery || item.isBrand || item.isProduct) {
                              return (
                                <li key={itemIdx}>
                                  <Link
                                    to="/search"
                                    search={{ q: item.searchQuery || item.label }}
                                    onClick={() => setHoveredSlug(null)}
                                    className="block py-1 text-xs text-muted-foreground hover:text-primary hover:underline font-medium"
                                  >
                                    {item.label}
                                  </Link>
                                </li>
                              )
                            }
                            return (
                              <li key={itemIdx}>
                                <Link
                                  to="/categories/$slug"
                                  params={{ slug: hoveredSlug }}
                                  search={item.handle ? { sub: item.handle } : undefined}
                                  onClick={() => setHoveredSlug(null)}
                                  className="block py-1 text-xs text-muted-foreground hover:text-primary hover:underline font-medium"
                                >
                                  {item.label}
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Bottom Quick-Action Bar */}
              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Explore thousands of authentic products in <strong className="text-foreground">{activeDept.title}</strong>
                </span>
                <Link
                  to="/categories/$slug"
                  params={{ slug: hoveredSlug }}
                  onClick={() => setHoveredSlug(null)}
                  className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline"
                >
                  <span>See all {activeDept.title}</span>
                  <ArrowRight size={14} weight="bold" />
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </nav>
  )
}
