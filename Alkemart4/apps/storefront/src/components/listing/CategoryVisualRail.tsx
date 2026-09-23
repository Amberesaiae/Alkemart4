import { useRef } from "react"
import { Link } from "@tanstack/react-router"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import { IconSafe, type IconId } from "@/design/icons"
import { iconForCategory } from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"

export type CategoryVisualItem = {
  id: string
  label: string
  slug: string
  handle?: string | null
  image?: string | null
  active?: boolean
  to?: string
  params?: Record<string, string>
  search?: Record<string, unknown>
}

const CATEGORY_IMAGE_MAP: Record<string, string> = {
  // L1 Top Departments
  "phones-electronics": "/images/categories/market-rail/electronics-v1.webp",
  electronics: "/images/categories/market-rail/electronics-v1.webp",
  "fashion-apparel": "/images/categories/market-rail/fashion-v1.webp",
  fashion: "/images/categories/market-rail/fashion-v1.webp",
  "home-living": "/images/categories/market-rail/home-v1.webp",
  home: "/images/categories/market-rail/home-v1.webp",
  "health-beauty": "/images/categories/market-rail/beauty-v1.webp",
  beauty: "/images/categories/market-rail/beauty-v1.webp",
  "baby-kids": "/images/categories/market-rail/baby-v1.webp",
  baby: "/images/categories/market-rail/baby-v1.webp",
  "food-groceries": "/images/categories/market-rail/groceries-v1.webp",
  groceries: "/images/categories/market-rail/groceries-v1.webp",
  food: "/images/categories/market-rail/groceries-v1.webp",
  beverages: "/images/categories/market-rail/beverages-v1.webp",
  "pet-care": "/images/categories/market-rail/pets-v1.webp",
  pets: "/images/categories/market-rail/pets-v1.webp",
  agriculture: "/images/categories/market-rail/agriculture-v1.webp",
  automotive: "/images/categories/market-rail/automotive-v1.webp",
  services: "/images/categories/market-rail/services-v1.webp",
  other: "/images/categories/market-rail/other-v1.webp",

  // L2 Subcategories (Phones & Electronics)
  phones: "/images/products/demo/flagship-phone.jpg",
  accessories: "/images/products/demo/fast-powerbank.jpg",
  computing: "/images/promos/editorial-desktops.jpg",
  "tvs-audio": "/images/products/demo/smart-tv.jpg",
  audio: "/images/products/demo/wireless-headphones.jpg",

  // L2 Subcategories (Fashion & Apparel)
  men: "/images/products/demo/bomber-jacket.jpg",
  women: "/images/products/demo/authentic-kente.jpg",
  kids: "/images/products/demo/kids-cotton-tee.jpg",
  shoes: "/images/products/demo/classic-clogs.jpg",
  bags: "/images/products/demo/leather-tote.jpg",

  // L2 Subcategories (Food & Groceries)
  staples: "/images/products/demo/jasmine-rice.jpg",
  "fresh-produce": "/images/categories/market-rail/groceries-v1.webp",
  "cooking-oil": "/images/categories/market-rail/groceries-v1.webp",
  snacks: "/images/products/demo/cocoa-powder.jpg",

  // L2 Subcategories (Home & Living)
  kitchen: "/images/products/demo/countertop-blender.jpg",
  appliances: "/images/products/demo/countertop-blender.jpg",
  bedding: "/images/products/demo/desk-lamp.jpg",
  decor: "/images/products/demo/desk-lamp.jpg",
  lighting: "/images/products/demo/desk-lamp.jpg",
  storage: "/images/products/demo/glass-containers.jpg",
  cleaning: "/images/products/demo/glass-containers.jpg",

  // L2 Subcategories (Health & Beauty)
  skincare: "/images/products/demo/shea-butter-balm.jpg",
  haircare: "/images/products/demo/shea-butter-balm.jpg",
  fragrance: "/images/products/demo/shea-butter-balm.jpg",
  cosmetics: "/images/products/demo/starface-patches.jpg",
  "personal-care": "/images/products/demo/starface-patches.jpg",

  // L2 Subcategories (Baby & Kids)
  diapers: "/images/categories/market-rail/baby-v1.webp",
  feeding: "/images/categories/market-rail/baby-v1.webp",
  clothing: "/images/products/demo/kids-cotton-tee.jpg",
  toys: "/images/categories/market-rail/baby-v1.webp",
}

export function resolveCategoryImage(handleOrSlug?: string | null): string | null {
  if (!handleOrSlug) return null
  const key = handleOrSlug.toLowerCase().trim()
  if (CATEGORY_IMAGE_MAP[key]) return CATEGORY_IMAGE_MAP[key]
  for (const [k, v] of Object.entries(CATEGORY_IMAGE_MAP)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

type Props = {
  items: CategoryVisualItem[]
  title?: string
  className?: string
}

/**
 * Top category rail:
 * A spacious, modular card housing category cards with real product cutout
 * photography and bold, readable typography.
 */
export function CategoryVisualRail({ items, title, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return
    const offset = dir === "left" ? -360 : 360
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" })
  }

  if (!items.length) return null

  return (
    <nav
      aria-label={title || "Categories"}
      className={cn(
        "group/rail relative py-1 sm:py-2",
        className,
      )}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Scroll categories left"
          className="absolute -left-2 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md opacity-0 transition-opacity hover:bg-muted group-hover/rail:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none"
        >
          <CaretLeft size={18} weight="bold" />
        </button>

        <div
          ref={scrollRef}
          className="scrollbar-none flex w-full items-stretch gap-3 overflow-x-auto scroll-smooth py-1 sm:gap-4"
        >
          {items.map((item) => {
            const imageSrc = item.image ?? resolveCategoryImage(item.handle || item.slug)
            const iconId: IconId = iconForCategory(item.label, item.handle || item.slug)

            const content = (
              <div className="group flex w-28 sm:w-32 md:w-36 shrink-0 flex-col items-center">
                {/* The card — image fills up the card */}
                <div
                  className={cn(
                    "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border transition-all duration-200",
                    item.active
                      ? "border-primary ring-2 ring-primary/50 shadow-xs"
                      : "border-border/80 bg-muted/20 hover:border-primary/60 hover:shadow-xs",
                  )}
                >
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted/40 text-muted-foreground">
                      <IconSafe name={iconId} size={36} preferAsset />
                    </div>
                  )}
                </div>

                {/* Text is outside the card */}
                <span
                  className={cn(
                    "mt-2 line-clamp-2 min-h-[2.25rem] w-full text-center text-xs sm:text-sm font-semibold leading-tight transition-colors",
                    item.active
                      ? "text-primary-strong font-bold"
                      : "text-foreground group-hover:text-primary-strong",
                  )}
                >
                  {item.label}
                </span>
              </div>
            )

            return (
              <Link
                key={item.id}
                to="/categories/$slug"
                params={{ slug: item.slug }}
                search={item.search as any}
                className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                {content}
              </Link>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Scroll categories right"
          className="absolute -right-2 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md opacity-0 transition-opacity hover:bg-muted group-hover/rail:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none"
        >
          <CaretRight size={18} weight="bold" />
        </button>
      </div>
    </nav>
  )
}
