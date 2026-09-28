import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const INTERVAL_MS = 6000

/**
 * Frame for phone art: the canvas's left 22% is empty (it's where the desktop
 * headline sits), so phones crop it away and anchor right — the artwork fills
 * the frame instead of floating in padding.
 */
const FRAME = "aspect-[1109/1034] object-cover object-right"

/**
 * One image stands still. Two or more crossfade, accept horizontal swipes and advance every 6s
 * and stop for reduced motion, while hidden or off screen, while touched or
 * focused, and for good on pause (WCAG 2.2.2).
 */
export function HeroArt({ images, captions = [], showDots = true, onSlideChange, className }: { images: string[]; captions?: string[]; showDots?: boolean; onSlideChange?: (index: number) => void; className?: string }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [holding, setHolding] = useState(false)
  const [eligible, setEligible] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const touchStart = useRef<number | null>(null)
  const count = images.length
  const many = count > 1
  useEffect(() => { onSlideChange?.(active) }, [active, onSlideChange])

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

  const go = (i: number) => setActive((i + count) % count)

  const rotating = many && eligible && !paused && !holding
  useEffect(() => {
    if (!rotating) return
    const timer = window.setInterval(() => go((active + 1) % count), INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [rotating, active, count])

  if (count === 0) return null
  if (!many) {
    return <img src={images[0]} alt="" width={1600} height={1200} fetchPriority="high" className={cn(FRAME, className)} />
  }

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured product collections"
      className={cn("relative", className)}
      onPointerDown={(e) => { setHolding(true); touchStart.current = e.clientX }}
      onPointerUp={(e) => {
        if (touchStart.current !== null && Math.abs(e.clientX - touchStart.current) > 35) go(active + (e.clientX < touchStart.current ? 1 : -1))
        touchStart.current = null
        setHolding(false)
      }}
      onPointerCancel={() => setHolding(false)}
      onFocusCapture={() => setHolding(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHolding(false)
      }}
    >
      <div
        className="relative aspect-[1109/1034] touch-pan-y"
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
            aria-hidden={i !== active}
            className={cn(FRAME, "absolute inset-0 size-full transition-opacity duration-700 ease-out motion-reduce:transition-none", i === active ? "opacity-100" : "opacity-0")}
          />
        ))}
      </div>
      {captions[active] ? <p className="mt-2 min-h-[2lh] text-center text-xs leading-tight font-medium">{captions[active]}</p> : null}
      {/* With dots: a row under the art. Without: the pause control takes no row of its own —
          on phones it sits just above the art's right edge (beside the short headline, clear of
          the artwork's notes); on wider screens on the art's bottom corner. */}
      <div className={cn("flex items-center", showDots ? "mt-1 justify-center" : "absolute right-0 bottom-[calc(100%-0.5rem)] md:top-auto md:bottom-0")}>
        {showDots && images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1} of ${count}`}
            aria-current={i === active}
            className="grid size-11 place-items-center"
          >
            <span className={cn("h-1.5 rounded-full bg-foreground transition-all", i === active ? "w-4" : "w-1.5 opacity-30")} />
          </button>
        ))}
        <Button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play slides" : "Pause slides"}
          variant="outline"
          size="icon"
          className="size-11 rounded-full border-foreground/15 bg-background/80 hover:bg-background"
        >
          <HugeiconsIcon icon={paused ? PlayIcon : PauseIcon} className="size-4" />
        </Button>
      </div>
    </div>
  )
}
