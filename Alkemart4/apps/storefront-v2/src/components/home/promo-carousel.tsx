import { useEffect, useRef, useState } from "react"
import type { HomeSection } from "@alkemart/shared/homepage"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, PauseIcon, PlayIcon } from "@hugeicons/core-free-icons"
import { SmartLink } from "@/components/commerce/smart-link"
import { Button } from "@/components/ui/button"
import { getVendorAppUrl } from "@/lib/env"
import { cn } from "@/lib/utils"

type Band = Extract<HomeSection, { type: "promo_band" }>

/** Desktop-only rotation of platform messages. Phones get no band (see PromoSection). */
export function PromoCarousel(_props: { section: Band }) {
  const slides = [
    { title: "See delivery costs before you order.", action: { label: "How delivery works", href: "/delivery" }, image: "/images/promos/campaign-delivery-calm-v1.webp", style: "bg-[#faf3e5] text-[#171719]", story: true },
    { title: "Compare prices across shops.", action: { label: "Compare and choose", href: "/categories/all" }, image: "/images/promos/campaign-compare-calm-v1.webp", style: "bg-[#b8c4b8] text-[#171719]", story: true },
    { title: "Your next find starts here.", action: { label: "Discover products", href: "/categories/all" }, image: "/images/promos/campaign-discovery-calm-v1.webp", style: "bg-[#f4efe5] text-[#171719]", story: true },
    { title: "Own a shop? Bring it online.", action: { label: "Start selling", href: getVendorAppUrl() }, image: "/images/promos/campaign-seller-calm-v1.webp", style: "bg-[#f4e5d0] text-[#171719]", story: true },
    // The band's own "deals" slide is gone: no deal copy without real deals behind it.
  ]
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const interacting = hovered || focused
  const [eligible, setEligible] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const pointer = useRef<number | null>(null)
  const swiped = useRef(false)
  const count = slides.length
  const move = (delta: number) => setActive((index) => (index + delta + count) % count)

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)")
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    const sync = () => setEligible(desktop.matches && !motion.matches && !document.hidden && visible)
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    if (root.current) observer.observe(root.current)
    desktop.addEventListener("change", sync)
    motion.addEventListener("change", sync)
    document.addEventListener("visibilitychange", sync)
    return () => {
      observer.disconnect()
      desktop.removeEventListener("change", sync)
      motion.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", sync)
    }
  }, [])

  useEffect(() => {
    if (!eligible || paused || interacting) return
    const timer = window.setInterval(() => setActive((index) => (index + 1) % count), 4000)
    return () => window.clearInterval(timer)
  }, [eligible, paused, interacting, count, active])

  return (
    <div ref={root} className="hidden md:block" role="region" aria-roledescription="carousel" aria-label="Alkemart campaigns"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
      onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1) } }}
      onPointerDown={(event) => { pointer.current = event.clientX; swiped.current = false }}
      onPointerUp={(event) => { if (pointer.current !== null && Math.abs(event.clientX - pointer.current) > 60) { swiped.current = true; move(event.clientX < pointer.current ? 1 : -1) }; pointer.current = null }}
      onClickCapture={(event) => { if (swiped.current) { event.preventDefault(); event.stopPropagation(); swiped.current = false } }}
      onPointerCancel={() => { pointer.current = null }}>
      <div className="relative aspect-[1612/300] overflow-hidden rounded-[2rem] [touch-action:pan-y]">
        {slides.map((slide, index) => (
          <div key={slide.image} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${count}`} aria-hidden={index !== active} inert={index !== active}
            className={cn("absolute inset-0 overflow-hidden transition-opacity duration-500 motion-reduce:transition-none", slide.style, index === active ? "z-10 opacity-100" : "z-0 opacity-0")}>
            <img src={slide.image} alt="" loading="lazy" draggable={false}
              className={cn("absolute inset-0 size-full object-contain", slide.story && "object-right")}
              style={slide.story ? { maskImage: "linear-gradient(to right, transparent 42%, black 65%)" } : undefined} />
            <div className="relative flex h-full w-[58%] flex-col justify-center gap-3 px-6 lg:px-8">
              <h2 className="max-w-lg text-xl leading-tight font-extrabold lg:text-3xl">{slide.title}</h2>
              {slide.action ? <Button asChild variant={slide.story ? "default" : "brand"} className="h-11 w-fit px-5">
                <SmartLink href={slide.action.href}>{slide.action.label}<HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" /></SmartLink>
              </Button> : null}
            </div>
          </div>
        ))}
      <div className="absolute right-4 bottom-1 z-20 flex items-center" aria-label="Campaign controls">
        {slides.map((slide, index) => <button key={slide.image} type="button" className="group grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={`Show campaign ${index + 1}: ${slide.title}`} aria-current={index === active ? "true" : undefined} onClick={() => setActive(index)}><span className={cn("h-1.5 rounded-full border border-black/30 shadow-[0_0_2px_1px_rgb(0_0_0/20%)] transition-colors group-hover:bg-white", index === active ? "w-4 bg-white" : "w-1.5 bg-white/60")} /></button>)}
        <button type="button" className="grid size-11 place-items-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={paused ? "Play campaigns" : "Pause campaigns"} aria-pressed={paused} onClick={() => setPaused(!paused)}>
          <span className="grid size-6 place-items-center rounded-full bg-black/35 hover:bg-black/55"><HugeiconsIcon icon={paused ? PlayIcon : PauseIcon} size={12} /></span>
        </button>
      </div>
      </div>
    </div>
  )
}
