import { useState, useMemo, useEffect } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { List, CaretRight, CaretDown } from "@phosphor-icons/react"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@workspace/ui"
import { DEFAULT_STORE_CATEGORIES, listStoreCategories } from "@/lib/products"
import { iconForCategory, resolveRailCategories } from "@/lib/catalog-nav"
import { IconSafe } from "@/design/icons"
import { cn } from "@/lib/utils"

import {
  MEGA_TAXONOMY,
  type MegaCategorySection,
  type MegaCategoryItem,
  type MegaDepartmentData,
} from "@/lib/mega-taxonomy"

export type { MegaCategorySection, MegaCategoryItem, MegaDepartmentData }
export { MEGA_TAXONOMY }

export function HeaderCategoryDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false)
  const [selectedHandle, setSelectedHandle] = useState<string>("phones-electronics")
  const [expandedMobileHandle, setExpandedMobileHandle] = useState<string | null>(null)

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

  // Sync active category from URL when menu opens or pathname changes
  useEffect(() => {
    if (!categories.length) return
    const matched = categories.find((c) => {
      const slug = (c.handle || c.id).toLowerCase()
      return pathname.startsWith(`/categories/${slug}`)
    })
    if (matched) {
      setSelectedHandle((matched.handle || matched.id).toLowerCase())
    } else if (categories[0]) {
      setSelectedHandle((categories[0].handle || categories[0].id).toLowerCase())
    }
  }, [pathname, categories, open])

  const activeDept = useMemo(() => {
    const fromTaxonomy = MEGA_TAXONOMY[selectedHandle]
    if (fromTaxonomy) return fromTaxonomy
    const cat = categories.find((c) => (c.handle || c.id).toLowerCase() === selectedHandle)
    return {
      title: cat?.name ?? "Department",
      sections: (cat?.children && cat.children.length > 0)
        ? [
            {
              title: "Subcategories",
              items: cat.children.map((ch) => ({ label: ch.name, handle: ch.handle })),
            },
          ]
        : [],
    }
  }, [selectedHandle, categories])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg border",
            open
              ? "border-primary bg-muted text-primary-strong shadow-xs"
              : "border-border/80 bg-background text-foreground hover:bg-muted hover:border-border",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
          )}
          aria-label="Browse categories menu"
          aria-expanded={open}
        >
          <List size={20} weight="bold" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="z-50 w-[95vw] sm:w-[680px] md:w-[840px] lg:w-[940px] max-w-[1040px] max-h-[82vh] overflow-hidden rounded-lg border border-border/80 bg-card p-0 shadow-2xl outline-none"
      >
        {/* Desktop 2-Pane Mega Menu (Jumia reference layout) */}
        <div className="hidden md:flex h-[520px] max-h-[75vh]">
          {/* Left Category Rail */}
          <div className="w-56 lg:w-64 shrink-0 border-r border-border/70 bg-muted/15 py-2.5 overflow-y-auto scrollbar-none flex flex-col">
            <div className="px-3.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Categories
            </div>
            <div className="flex-1 space-y-0.5 px-1.5">
              {categories.map((cat) => {
                const slug = (cat.handle || cat.id).toLowerCase()
                const isSelected = selectedHandle === slug
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onMouseEnter={() => setSelectedHandle(slug)}
                    onFocus={() => setSelectedHandle(slug)}
                    onClick={() => setSelectedHandle(slug)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold",
                      isSelected
                        ? "bg-card text-primary-strong shadow-2xs font-bold ring-1 ring-border/80"
                        : "text-foreground hover:bg-muted/60",
                    )}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <IconSafe
                        name={iconForCategory(cat.name, cat.handle)}
                        size={17}
                        preferAsset
                        className={cn(
                          "shrink-0",
                          isSelected ? "text-primary-strong" : "text-muted-foreground",
                        )}
                      />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <CaretRight
                      size={13}
                      weight={isSelected ? "bold" : "regular"}
                      className={cn(
                        "shrink-0",
                        isSelected ? "text-primary-strong translate-x-0.5" : "text-muted-foreground/60",
                      )}
                    />
                  </button>
                )
              })}
            </div>

            <div className="border-t border-border/70 mt-2 pt-2 px-2.5 space-y-1">
              <Link
                to="/categories/$slug"
                params={{ slug: "all" }}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-bold text-primary-strong hover:bg-muted/60"
              >
                <span>All Categories</span>
                <CaretRight size={13} />
              </Link>
              <Link
                to="/shops"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/60"
              >
                <span>Stores</span>
                <CaretRight size={13} />
              </Link>
            </div>
          </div>

          {/* Right Flyout Subcategory Panel */}
          <div className="flex-1 bg-card p-6 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {activeDept.title}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Shop top products and brands in this department.
                </p>
              </div>
              <Link
                to="/categories/$slug"
                params={{ slug: selectedHandle }}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary-strong hover:underline"
              >
                <span>View all</span>
                <CaretRight size={13} weight="bold" />
              </Link>
            </div>

            {activeDept.sections.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                {activeDept.sections.map((section, sIdx) => (
                  <div key={sIdx} className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground border-b border-border/50 pb-1">
                      {section.title}
                    </h3>
                    <ul className="space-y-1">
                      {section.items.map((item, iIdx) => (
                        <li key={iIdx}>
                          <Link
                            to="/categories/$slug"
                            params={{ slug: selectedHandle }}
                            search={item.handle ? { sub: item.handle } : undefined}
                            onClick={() => setOpen(false)}
                            className="block py-1 text-xs text-muted-foreground hover:text-primary-strong hover:underline font-medium"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-center p-8">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Explore {activeDept.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Browse all catalog products in this department.
                  </p>
                  <Link
                    to="/categories/$slug"
                    params={{ slug: selectedHandle }}
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary-strong"
                  >
                    Browse {activeDept.title}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile View: Collapsible Accordion Navigation */}
        <div className="md:hidden max-h-[75vh] overflow-y-auto p-3 space-y-1">
          <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Categories
          </div>
          {categories.map((cat) => {
            const slug = (cat.handle || cat.id).toLowerCase()
            const isExpanded = expandedMobileHandle === slug
            const taxonomy = MEGA_TAXONOMY[slug]

            return (
              <div key={cat.id} className="rounded-lg border border-border/60 overflow-hidden">
                <div className="flex items-center justify-between bg-muted/20 px-3 py-2.5">
                  <Link
                    to="/categories/$slug"
                    params={{ slug }}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 text-xs font-bold text-foreground"
                  >
                    <IconSafe
                      name={iconForCategory(cat.name, cat.handle)}
                      size={17}
                      preferAsset
                      className="text-muted-foreground"
                    />
                    <span>{cat.name}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setExpandedMobileHandle(isExpanded ? null : slug)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    aria-label={`Toggle ${cat.name} subcategories`}
                  >
                    <CaretDown
                      size={14}
                      weight="bold"
                      className={cn("", isExpanded && "rotate-180")}
                    />
                  </button>
                </div>

                {isExpanded && taxonomy ? (
                  <div className="bg-card p-3 space-y-3 border-t border-border/50">
                    {taxonomy.sections.map((sec, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="text-[11px] font-bold uppercase text-foreground">
                          {sec.title}
                        </div>
                        <div className="grid grid-cols-2 gap-1 pl-1">
                          {sec.items.map((item, itemIdx) => (
                            <Link
                              key={itemIdx}
                              to="/categories/$slug"
                              params={{ slug }}
                              search={item.handle ? { sub: item.handle } : undefined}
                              onClick={() => setOpen(false)}
                              className="py-1 text-xs text-muted-foreground hover:text-primary-strong"
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}

          <div className="pt-2 border-t border-border/60 flex items-center justify-between px-2">
            <Link
              to="/categories/$slug"
              params={{ slug: "all" }}
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-primary-strong"
            >
              All Categories →
            </Link>
            <Link
              to="/shops"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-foreground"
            >
              All Stores →
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
