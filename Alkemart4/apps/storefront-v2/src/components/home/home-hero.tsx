import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon, Search01Icon, UserGroupIcon, WashingMachineIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { DEPARTMENT_ICON } from "@/components/commerce/category-tile"
import { departmentFor } from "@/lib/departments"
import { useSearchHistory } from "@/lib/search-history"
import type { StoreCategory } from "@/lib/products"
import { SmartLink } from "@/components/commerce/smart-link"
import { setHomeSticky } from "@/lib/home-sticky"
import { REFERENCE_DEPARTMENTS, referenceDepartmentHref } from "./reference-departments"
import { HeroPhotos, type HeroPhoto } from "./hero-photos"

/** Phone header height: the hero search counts as scrolled away once it passes under it. */
const PHONE_HEADER_PX = 64

/**
 * Full-bleed gold hero. Phones get the compact version: one short line beside
 * a rotating real photo, search, and four departments; once search scrolls
 * away the header carries it (lib/home-sticky). Desktop art is layout only — the right-hand art (product collage,
 * colour petals and the handwritten "More choices / Better prices / Trusted
 * sellers" notes) is one generated image at /images/hero/home.webp
 * (docs/CODEX-ASSETS.md). Until it exists the gold simply stands on its own.
 */
export function HomeHero({ departments, allCategories, stocked, photos, photosLoading }: {
  departments: StoreCategory[]
  /** Full taxonomy (sub-categories too), for entry points like Appliances. */
  allCategories: StoreCategory[]
  /** Categories with listings; null while unknown (show everything). */
  stocked: Set<string> | null
  /** Phone hero photos: live shops and stocked departments only. */
  photos: HeroPhoto[]
  photosLoading: boolean
}) {
  const shownDepartments = stocked ? departments.filter((c) => stocked.has(c.id)) : departments
  // Keyed by content so the header only re-renders when the departments change.
  const chipKey = shownDepartments.slice(0, 6).map((c) => `${c.handle ?? c.id}\t${c.name.split(" & ")[0]}`).join("\n")
  const chips = useMemo(
    () => (chipKey ? chipKey.split("\n").map((line) => {
      const [slug, label] = line.split("\t")
      return { slug, label }
    }) : []),
    [chipKey],
  )
  const searchRef = useRef<HTMLFormElement>(null)
  useEffect(() => setHomeSticky({ chips }), [chips])
  useEffect(() => {
    const el = searchRef.current
    if (!el) return
    const phone = window.matchMedia("(max-width: 47.99rem)")
    const observer = new IntersectionObserver(
      ([entry]) => setHomeSticky({ stuck: phone.matches && !entry.isIntersecting && entry.boundingClientRect.top < PHONE_HEADER_PX }),
      { rootMargin: `-${PHONE_HEADER_PX}px 0px 0px 0px` },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      setHomeSticky({ stuck: false })
    }
  }, [])
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

      <div className="container-page pt-3 pb-5 md:pt-10 md:pb-16 lg:pt-8 lg:pb-20">
        <div className="max-w-2xl min-w-0">
          <p className="mb-5 hidden items-center gap-2 rounded-full bg-background/60 px-3.5 py-1.5 text-sm font-semibold md:inline-flex">
            <HugeiconsIcon icon={UserGroupIcon} className="size-4" />
            Many sellers. More choices. One marketplace.
          </p>
          <div className="flex items-center gap-3 md:block">
            <h1
              id="home-hero-title"
              className="min-w-0 flex-1 text-[1.375rem] leading-tight font-extrabold tracking-tight text-balance md:text-6xl md:leading-[0.95] md:tracking-[-0.045em] lg:text-[4.25rem]"
            >
              <span className="md:hidden">Many sellers. One marketplace.</span>
              <span className="hidden md:inline">Whatever you’re looking for, someone’s selling it.</span>
            </h1>
            {photos.length ? (
              <HeroPhotos photos={photos} className="w-28 shrink-0 md:hidden" />
            ) : photosLoading ? (
              <div aria-hidden className="aspect-square w-28 shrink-0 rounded-2xl bg-background/40 md:hidden" />
            ) : null}
          </div>
          <p className="mt-4 hidden max-w-xl text-lg font-medium text-foreground/80 md:block">
            Discover products from trusted sellers, all in one place.
          </p>

          <form
            ref={searchRef}
            role="search"
            className="mt-3 flex max-w-2xl items-center gap-2 rounded-full bg-background p-1.5 shadow-lift md:mt-6"
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
              className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="lg" className="h-11 px-6">
              Search
            </Button>
          </form>

          {shownDepartments.length > 0 ? (
            <ul aria-label="Popular departments" className="mt-3 grid grid-cols-5 gap-1 md:hidden">
              {shownDepartments.slice(0, 4).map((c) => {
                const dept = departmentFor(c.handle, c.name)
                return (
                  <li key={c.id} className="min-w-0">
                    <Link
                      to="/categories/$slug"
                      params={{ slug: c.handle ?? c.id }}
                      className="flex flex-col items-center gap-1 rounded-xl py-1 text-center text-xs font-semibold focus-visible:outline-2 focus-visible:outline-foreground"
                    >
                      <span className="grid size-12 place-items-center rounded-full bg-background/70">
                        <HugeiconsIcon icon={DEPARTMENT_ICON[dept.id]} className="size-6" />
                      </span>
                      <span className="w-full truncate">{c.name.split(" & ")[0]}</span>
                    </Link>
                  </li>
                )
              })}
              <li className="min-w-0">
                <Link to="/categories" className="flex flex-col items-center gap-1 rounded-xl py-1 text-center text-xs font-semibold focus-visible:outline-2 focus-visible:outline-foreground">
                  <span className="grid size-12 place-items-center rounded-full bg-background/70">
                    <HugeiconsIcon icon={MoreHorizontalIcon} className="size-6" />
                  </span>
                  All
                </Link>
              </li>
            </ul>
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
      </div>
    </section>
  )
}
