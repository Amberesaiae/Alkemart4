import { cn } from "@/lib/utils"

type Props = {
  title: string
  body?: string
  imageSrc?: string | null
  className?: string
}

export function ListingHero({ title, body, imageSrc, className }: Props) {
  return (
    <section
      className={cn(
        "grid items-center gap-5 overflow-hidden rounded-2xl border border-border bg-card p-5 sm:grid-cols-[1fr_minmax(200px,280px)] sm:p-6",
        className,
      )}
      aria-label="Department intro"
    >
      <div className="max-w-lg space-y-2">
        <h1 className="text-xl font-extrabold leading-tight tracking-tight sm:text-2xl lg:text-3xl">
          {title}
        </h1>
        {body ? <p className="max-w-md text-sm leading-snug text-muted-foreground">{body}</p> : null}
      </div>
      {imageSrc ? (
        <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-muted sm:h-44">
          <img src={imageSrc} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="hidden h-40 rounded-2xl bg-muted sm:block" aria-hidden />
      )}
    </section>
  )
}

export function listingHeroArt(slug: string): string | null {
  const s = slug.toLowerCase()
  if (/pet|animal/.test(s)) return "/images/categories/pets.webp"
  if (/food|groc|agricult|bever/.test(s)) return "/images/categories/food.webp"
  if (/beauty|personal|cosmetic|health/.test(s)) return "/images/categories/cosmetics.webp"
  if (/electron|phone|tech/.test(s)) return "/images/categories/electronics.webp"
  if (s === "all" || !s) return "/images/categories/electronics.webp"
  return null
}

export function listingHeroTitle(departmentName: string, isAll: boolean): string {
  if (isAll) return "Get All Products From One Place!"
  const name = departmentName.trim() || "Products"
  return `Get All ${name} From One Place!`
}
