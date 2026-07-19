import { cn } from "@/lib/utils"

type Props = {
  /** Single clean page title, e.g. "All products" or "Food & groceries" */
  title: string
  /** @deprecated unused — kept for call-site compat */
  accent?: string
  body?: string
  /** Category / department photo */
  imageSrc?: string | null
  imageAlt?: string
  className?: string
}

/**
 * PLP hero — one professional title + optional short body + category photo.
 * No multi-line marketing slogans in the H1 (avoids tab titles like
 * "… from Ghana sellers").
 */
export function ListingHero({
  title,
  body,
  imageSrc,
  imageAlt = "",
  className,
}: Props) {
  return (
    <section
      className={cn(
        "listing-hero grid items-center gap-5 overflow-hidden p-5 sm:grid-cols-[1fr_minmax(200px,280px)] sm:gap-6 sm:p-6 lg:p-7",
        className,
      )}
      aria-label="Department intro"
    >
      <div className="max-w-lg space-y-2">
        <h1 className="text-xl font-extrabold leading-tight tracking-tight text-foreground sm:text-2xl lg:text-[1.65rem]">
          {title}
        </h1>
        {body ? (
          <p className="max-w-md text-sm leading-snug text-muted-foreground">
            {body}
          </p>
        ) : null}
      </div>

      {imageSrc ? (
        <div className="listing-hero-art relative mx-auto flex h-40 w-full max-w-[240px] items-end justify-center sm:mx-0 sm:h-44 sm:max-w-none lg:h-48">
          {/* Soft oval ground behind the photo */}
          <span
            className="listing-hero-ground pointer-events-none absolute bottom-0 left-1/2 z-0 h-[48%] w-[92%] -translate-x-1/2 rounded-[100%]"
            aria-hidden
          />
          {/* Rounded frame so category photos crop cleanly (cover, not letterbox) */}
          <div className="relative z-10 h-full w-full overflow-hidden rounded-2xl bg-muted shadow-sm ring-1 ring-black/[0.06]">
            <img
              src={imageSrc}
              alt={imageAlt}
              className="h-full w-full object-cover object-center"
              decoding="async"
              loading="eager"
              draggable={false}
            />
          </div>
        </div>
      ) : (
        <div
          className="hidden h-40 w-48 rounded-2xl bg-muted sm:block lg:h-44 lg:w-56"
          aria-hidden
        />
      )}
    </section>
  )
}

/**
 * Map department slug → category photography (public/images/categories).
 * Prefer *-source.jpg (higher quality stock); fall back to .webp.
 */
export function listingHeroArt(slug: string): string | null {
  const s = slug.toLowerCase()
  if (s === "all" || !s) {
    return "/images/categories/electronics-source.jpg"
  }
  if (/pet|animal|dog|cat/.test(s)) return "/images/categories/pets-source.jpg"
  if (/food|groc|agricult|bever|kitchen/.test(s))
    return "/images/categories/food-source.jpg"
  if (/beauty|personal|cosmetic|health|skin/.test(s))
    return "/images/categories/cosmetics-source.jpg"
  if (/electron|phone|tech|gadget|comput/.test(s))
    return "/images/categories/electronics-source.jpg"
  return "/images/categories/electronics-source.jpg"
}

export function listingHeroTitle(
  departmentName: string,
  isAll: boolean,
): string {
  if (isAll) return "All products"
  const name = departmentName?.trim() || "Products"
  return name
}

/** @deprecated accent removed from hero — returns empty */
export function listingHeroAccent(_isAll?: boolean): string {
  return ""
}

export function listingHeroBody(isAll: boolean, departmentName: string): string {
  if (isAll) return "Compare multi-seller prices on alkemart."
  const name = departmentName?.trim()
  return name
    ? `Shop ${name.toLowerCase()} — compare offers and prices.`
    : "Compare multi-seller prices on alkemart."
}
