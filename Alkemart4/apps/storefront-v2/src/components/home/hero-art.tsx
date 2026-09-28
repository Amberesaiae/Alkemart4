import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

const INTERVAL_MS = 5000

/**
 * One image stands still. Two or more swipe (scroll-snap), advance every 5s
 * and stop for reduced motion, while hidden or off screen, while touched or
 * focused, and for good on pause (WCAG 2.2.2).
 */
export function HeroArt({ images, className }: { images: string[]; className?: string }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [holding, setHolding] = useState(false)
  const [eligible, setEligible] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const count = images.length
  const many = count > 1

  useEffect(() => {
    if (!many) return
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
  }, [many])

  const go = (i: number) => {
    const el = track.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" })
  }

  const rotating = many && eligible && !paused && !holding
  useEffect(() => {
    if (!rotating) return
    const timer = window.setInterval(() => go((active + 1) % count), INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [rotating, active, count])

  if (count === 0) return null
  if (!many) {
    return <img src={images[0]} alt="" width={1600} height={1200} fetchPriority="high" className={cn("aspect-[4/3] object-contain", className)} />
  }

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label="alkemart"
      className={cn("relative", className)}
      onPointerDown={() => setHolding(true)}
      onPointerUp={() => setHolding(false)}
      onPointerCancel={() => setHolding(false)}
      onFocusCapture={() => setHolding(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHolding(false)
      }}
    >
      <div
        ref={track}
        onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            width={1600}
            height={1200}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : undefined}
            className="aspect-[4/3] w-full shrink-0 snap-center object-contain"
          />
        ))}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1">
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1} of ${count}`}
            aria-current={i === active}
            className="grid size-6 place-items-center"
          >
            <span className={cn("h-1.5 rounded-full bg-foreground transition-all", i === active ? "w-4" : "w-1.5 opacity-30")} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play slides" : "Pause slides"}
          className="grid size-6 place-items-center"
        >
          <HugeiconsIcon icon={paused ? PlayIcon : PauseIcon} className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
