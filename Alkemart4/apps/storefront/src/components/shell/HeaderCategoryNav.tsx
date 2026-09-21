import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import { DEFAULT_STORE_CATEGORIES, listStoreCategories } from "@/lib/products"
import { iconForCategory, resolveHeaderCategories } from "@/lib/catalog-nav"
import { IconSafe } from "@/design/icons"
import { cn } from "@/lib/utils"

export function HeaderCategoryNav({ pathname }: { pathname: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const categoriesQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    staleTime: 5 * 60_000,
  })

  const categories = useMemo(
    () =>
      resolveHeaderCategories(
        (categoriesQ.data?.length ?? 0) > 0
          ? categoriesQ.data!
          : DEFAULT_STORE_CATEGORIES,
      ),
    [categoriesQ.data],
  )

  function move(direction: -1 | 1) {
    scrollRef.current?.scrollBy({ left: direction * 420, behavior: "smooth" })
  }

  function updateScrollState() {
    const node = scrollRef.current
    if (!node) return
    setCanScrollLeft(node.scrollLeft > 2)
    setCanScrollRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 2)
  }

  useEffect(() => {
    updateScrollState()
    const node = scrollRef.current
    if (!node) return
    node.addEventListener("scroll", updateScrollState, { passive: true })
    window.addEventListener("resize", updateScrollState)
    return () => {
      node.removeEventListener("scroll", updateScrollState)
      window.removeEventListener("resize", updateScrollState)
    }
  }, [categories.length])

  return (
    <nav className="flex min-w-0 flex-1 items-center" aria-label="Departments and stores">
      <button
        type="button"
        onClick={() => move(-1)}
        disabled={!canScrollLeft}
        className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        aria-label="Scroll categories left"
      >
        <CaretLeft size={16} weight="bold" />
      </button>

      <div ref={scrollRef} className="scrollbar-none min-w-0 flex-1 overflow-x-auto scroll-smooth">
        <div className="flex w-max items-center gap-1 pr-2">
          {categories.map((category) => {
            const slug = (category.handle || category.id).toLowerCase()
            const active = pathname.startsWith(`/categories/${slug}`)
            return (
              <Link
                key={category.id}
                to="/categories/$slug"
                params={{ slug }}
                className={cn(
                  "inline-flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-base font-bold transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <IconSafe name={iconForCategory(category.name, category.handle)} size={18} preferAsset />
                {category.name}
              </Link>
            )
          })}
          <Link
            to="/shops"
            className={cn(
              "inline-flex min-h-12 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-sm font-extrabold transition-colors hover:bg-muted",
              pathname.startsWith("/shops") ? "bg-muted text-foreground" : "text-foreground",
            )}
            aria-current={pathname.startsWith("/shops") ? "page" : undefined}
          >
            Stores
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={() => move(1)}
        disabled={!canScrollRight}
        className="ml-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        aria-label="Scroll categories right"
      >
        <CaretRight size={16} weight="bold" />
      </button>
    </nav>
  )
}
