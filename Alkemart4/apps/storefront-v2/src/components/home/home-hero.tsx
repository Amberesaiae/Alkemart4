import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon, Search01Icon, WashingMachineIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { DEPARTMENT_ICON } from "@/components/commerce/category-tile"
import { useSearchHistory } from "@/lib/search-history"
import type { StoreCategory } from "@/lib/products"
import { SmartLink } from "@/components/commerce/smart-link"
import { REFERENCE_DEPARTMENTS, referenceDepartmentHref } from "./reference-departments"
import { HeroArt } from "./hero-art"

/**
 * Product collages share the existing hero style, with distinct products.
 * See docs/HERO-COLLAGES-2026-09-28.md.
 */
const PHONE_HERO_ART = ["/images/hero/home.webp", "/images/hero/craft-v1.webp", "/images/hero/interiors-v1.webp"]
const DESKTOP_HEADLINES = ["Many sellers. One marketplace.", "Find your next favourite.", "Find your next favourite."]

/** Phone department chips under the hero search. */
const CHIP =
  "inline-flex h-8 shrink-0 items-center rounded-full bg-background/80 px-3 text-[length:var(--text-legacy-13)] font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-foreground"

/**
 * Gold hero: mobile headline above the collage; desktop headline, search
 * and departments beside it. Both rotate the same three product collections.
 */
export function HomeHero({ departments, allCategories, stocked }: {
  departments: StoreCategory[]
  /** Full taxonomy (sub-categories too), for entry points like Appliances. */
  allCategories: StoreCategory[]
  /** Categories with listings; null while unknown (show everything). */
  stocked: Set<string> | null
}) {
  // Chip row scrolls sideways: departments with listings first, then the other
  // main departments in buyer order, up to eight, then "All".
  const byStock = stocked
    ? [...departments.filter((c) => stocked.has(c.id)), ...departments.filter((c) => !stocked.has(c.id))]
    : departments
  const chips = byStock.slice(0, 8).map((c) => ({ label: c.name.split(" & ")[0], slug: c.handle ?? c.id }))
  const navigate = useNavigate()
  const { trackSearch } = useSearchHistory()
  const [q, setQ] = useState("")
  const [desktopSlide, setDesktopSlide] = useState(0)

  return (
    <section id="home-hero" aria-labelledby="home-hero-title" className="relative isolate -mt-3 overflow-hidden bg-brand pt-3 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-4 after:rounded-t-2xl after:bg-background after:content-[''] lg:mt-0 lg:pt-0">
      <div className="container-page pt-2 pb-6 md:grid md:grid-cols-2 md:items-center md:gap-8 md:pt-6 md:pb-16">
        <div className="max-w-2xl min-w-0">
          <div>
            <h1
              id="home-hero-title"
              className="text-2xl leading-tight font-extrabold tracking-tight text-balance md:relative md:min-h-[3lh] md:text-5xl md:leading-[0.95] md:tracking-[-0.045em] lg:min-h-[2.2lh] lg:text-[4.25rem]"
            >
              <span className="md:hidden">Find your next favourite.</span>
              {DESKTOP_HEADLINES.map((headline, i) => <span key={i} aria-hidden={i !== desktopSlide} className={`hidden md:absolute md:inset-0 md:flex md:items-center transition-opacity duration-700 motion-reduce:transition-none ${i === desktopSlide ? "opacity-100" : "opacity-0"}`}>{headline}</span>)}
            </h1>
            <HeroArt images={PHONE_HERO_ART} showDots={false} className="mt-2 w-full md:hidden" />
          </div>

          <form
            role="search"
            className="mt-2 flex max-w-2xl items-center gap-2 rounded-full bg-background p-1 shadow-lift md:mt-6 md:p-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              const term = q.trim()
              if (!term) return
              trackSearch(term)
              void navigate({ to: "/search", search: { q: term } })
            }}
          >
            <HugeiconsIcon icon={Search01Icon} className="ml-3 size-[18px] shrink-0 text-muted-foreground md:size-5" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search phones, sneakers, beauty, home…"
              aria-label="Search alkemart"
              enterKeyHint="search"
              className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:h-11"
            />
            <Button type="submit" size="lg" className="h-10 px-5 md:h-11 md:px-6">
              Search
            </Button>
          </form>

          {chips.length > 0 ? (
            <nav aria-label="Popular departments" className="mt-3 flex gap-2 overflow-x-auto rounded-full p-1 [scrollbar-width:none] md:hidden">
              {chips.map((c) => (
                <Link key={c.slug} to="/categories/$slug" params={{ slug: c.slug }} className={CHIP}>
                  {c.label}
                </Link>
              ))}
              <Link to="/categories" className={CHIP}>
                All
              </Link>
            </nav>
          ) : null}
          <ul aria-label="Popular departments" className="mt-6 hidden gap-4 pb-1 md:flex lg:gap-5">
            {REFERENCE_DEPARTMENTS.map(dept => (
              <li key={dept.id} className="min-w-0 flex-1">
                <SmartLink href={referenceDepartmentHref(dept.id, allCategories.length ? allCategories : departments)} className="group flex flex-col items-center gap-1.5 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4">
                  <span className="grid size-14 place-items-center rounded-full bg-background/70 group-hover:bg-background/90"><HugeiconsIcon icon={dept.id === "appliances" ? WashingMachineIcon : DEPARTMENT_ICON[dept.id]} className="size-6" strokeWidth={2} /></span>
                  <span>{dept.short}</span>
                </SmartLink>
              </li>
            ))}
            <li className="min-w-0 flex-1"><Link to="/categories" className="flex flex-col items-center gap-1.5 text-center text-sm font-semibold"><span className="grid size-14 place-items-center rounded-full bg-background/70"><HugeiconsIcon icon={MoreHorizontalIcon} className="size-6" strokeWidth={2} /></span>More</Link></li>
          </ul>
        </div>
        <HeroArt images={PHONE_HERO_ART} showDots={false} onSlideChange={setDesktopSlide} className="mx-auto hidden w-full max-w-[34rem] md:block" />
      </div>
    </section>
  )
}
