import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon, Search01Icon, UserGroupIcon, WashingMachineIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { DEPARTMENT_ICON } from "@/components/commerce/category-tile"
import { departmentFor } from "@/lib/departments"
import { useSearchHistory } from "@/lib/search-history"
import type { StoreCategory } from "@/lib/products"
import { SmartLink } from "@/components/commerce/smart-link"
import { REFERENCE_DEPARTMENTS, referenceDepartmentHref } from "./reference-departments"

/**
 * Full-bleed gold hero. Layout only — the right-hand art (product collage,
 * colour petals and the handwritten "More choices / Better prices / Trusted
 * sellers" notes) is one generated image at /images/hero/home.webp
 * (docs/CODEX-ASSETS.md). Until it exists the gold simply stands on its own.
 */
export function HomeHero({ departments }: { departments: StoreCategory[] }) {
  const navigate = useNavigate()
  const { trackSearch } = useSearchHistory()
  const [q, setQ] = useState("")
  const [art, setArt] = useState(true)

  return (
    <section aria-labelledby="home-hero-title" className="relative isolate overflow-hidden bg-brand">
      {art ? (
        // Aligned to the page column (not the viewport edge); the bottom 3.5rem
        // is left clear because the white panel overlaps it.
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
          <div className="container-page relative h-full">
            <img
              src="/images/hero/home.webp"
              alt=""
              fetchPriority="high"
              onError={() => setArt(false)}
              className="absolute top-5 right-4 bottom-16 w-[50%] object-contain object-right sm:right-6 lg:right-8"
            />
          </div>
        </div>
      ) : null}

      <div className="container-page pt-6 pb-16 sm:pt-10 lg:pt-8 lg:pb-20">
        <div className="max-w-2xl min-w-0">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-background/60 px-3.5 py-1.5 text-xs font-semibold sm:text-sm">
            <HugeiconsIcon icon={UserGroupIcon} className="size-4" />
            Many sellers. More choices. One marketplace.
          </p>
          <h1
            id="home-hero-title"
            className="text-[2.4rem] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance sm:text-6xl lg:text-[4.25rem]"
          >
            Whatever you’re looking for, someone’s selling it.
          </h1>
          <p className="mt-4 max-w-xl text-base font-medium text-foreground/80 sm:text-lg">
            Discover products from trusted sellers, all in one place.
          </p>

          <form
            role="search"
            className="mt-6 flex max-w-2xl items-center gap-2 rounded-full bg-background p-1.5 shadow-lift"
            onSubmit={(e) => {
              e.preventDefault()
              const term = q.trim()
              if (!term) return
              trackSearch(term)
              void navigate({ to: "/search", search: { q: term } })
            }}
          >
            <HugeiconsIcon icon={Search01Icon} className="ml-3 size-5 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search phones, sneakers, beauty, home…"
              aria-label="Search alkemart"
              enterKeyHint="search"
              className="h-11 min-w-0 flex-1 bg-transparent text-[length:var(--text-legacy-15)] outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="lg" className="h-11 px-6">
              Search
            </Button>
          </form>

          {departments.length > 0 ? (
            <ul aria-label="Popular departments" className="mt-6 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:gap-5 md:hidden">
              {departments.slice(0, 6).map((c) => {
                const dept = departmentFor(c.handle, c.name)
                return (
                  <li key={c.id} className="shrink-0">
                    <Link
                      to="/categories/$slug"
                      params={{ slug: c.handle ?? c.id }}
                      className="group flex w-16 flex-col items-center gap-1.5 text-center text-xs font-semibold sm:w-20 sm:text-sm"
                    >
                      <span className="grid size-14 place-items-center rounded-full bg-background/70 sm:size-16">
                        <HugeiconsIcon icon={DEPARTMENT_ICON[dept.id]} className="size-6" />
                      </span>
                      <span className="line-clamp-2 leading-tight">{c.name.split(" & ")[0]}</span>
                    </Link>
                  </li>
                )
              })}
              <li className="shrink-0">
                <Link to="/categories" className="group flex w-16 flex-col items-center gap-1.5 text-center text-xs font-semibold sm:w-20 sm:text-sm">
                  <span className="grid size-14 place-items-center rounded-full bg-background/70 sm:size-16">
                    <HugeiconsIcon icon={MoreHorizontalIcon} className="size-6" />
                  </span>
                  More
                </Link>
              </li>
            </ul>
          ) : null}
          <ul aria-label="Popular departments" className="mt-6 hidden gap-4 pb-1 md:flex lg:gap-5">
            {REFERENCE_DEPARTMENTS.map(dept => (
              <li key={dept.id} className="min-w-0 flex-1">
                <SmartLink href={referenceDepartmentHref(dept.id, departments)} className="group flex flex-col items-center gap-1.5 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4">
                  <span className="grid size-14 place-items-center rounded-full bg-background/70 group-hover:bg-background/90"><HugeiconsIcon icon={dept.id === "appliances" ? WashingMachineIcon : DEPARTMENT_ICON[dept.id]} className="size-6" strokeWidth={2} /></span>
                  <span>{dept.short}</span>
                </SmartLink>
              </li>
            ))}
            <li className="min-w-0 flex-1"><Link to="/categories" className="flex flex-col items-center gap-1.5 text-center text-sm font-semibold"><span className="grid size-14 place-items-center rounded-full bg-background/70"><HugeiconsIcon icon={MoreHorizontalIcon} className="size-6" strokeWidth={2} /></span>More</Link></li>
          </ul>
        </div>
      </div>
    </section>
  )
}
