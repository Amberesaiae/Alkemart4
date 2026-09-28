import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons"
import { SmartLink } from "@/components/commerce/smart-link"
import { cn } from "@/lib/utils"

export type HeroPhoto = { key: string; image: string; caption: string; href: string }

const INTERVAL_MS = 5000

/**
 * Phone hero: one photo at a time, each a real shop or a stocked department,
 * with its name under it. Rotation stops for reduced motion, while the page
 * is hidden or off screen, while the buyer is touching or focusing it, and
 * for good once they press pause (WCAG 2.2.2).
 */
export function HeroPhotos({ photos, className }: { photos: HeroPhoto[]; className?: string }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [holding, setHolding] = useState(false)
  const [eligible, setEligible] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const count = photos.length
  const index = count ? active % count : 0

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    const sync = () => setEligible(!motion.matches && !document.hidden && visible)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    if (root.current) observer.observe(root.current)
    motion.addEventListener("change", sync)
    document.addEventListener("visibilitychange", sync)
    return () => {
      observer.disconnect()
      motion.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", sync)
    }
  }, [])

  const rotating = eligible && !paused && !holding && count > 1
  useEffect(() => {
    if (!rotating) return
    const timer = window.setInterval(() => setActive((i) => (i + 1) % count), INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [rotating, count])

  if (count === 0) return null
  const current = photos[index]

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label="On alkemart now"
      className={cn("min-w-0", className)}
      onPointerDown={() => setHolding(true)}
      onPointerUp={() => setHolding(false)}
      onPointerCancel={() => setHolding(false)}
      onFocusCapture={() => setHolding(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHolding(false)
      }}
    >
      <div className="relative" aria-live={rotating ? "off" : "polite"}>
        <SmartLink
          href={current.href}
          className="group flex flex-col gap-1.5 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <span className="relative block aspect-square overflow-hidden rounded-2xl bg-background/40">
            {photos.map((p, i) => (
              <img
                key={p.key}
                src={p.image}
                alt=""
                width={320}
                height={320}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className={cn(
                  "absolute inset-0 size-full object-cover transition-opacity duration-500 motion-reduce:transition-none",
                  i === index ? "opacity-100" : "opacity-0",
                )}
              />
            ))}
          </span>
          <span className="truncate text-xs font-semibold text-foreground/80 group-hover:underline">{current.caption}</span>
        </SmartLink>
        {count > 1 ? (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play photos" : "Pause photos"}
            className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-background/90 text-foreground focus-visible:outline-2 focus-visible:outline-foreground"
          >
            <HugeiconsIcon icon={paused ? PlayIcon : PauseIcon} className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
