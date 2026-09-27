import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Product gallery. Desktop: vertical thumbnails + main stage. Phone: swipe
 * (scroll-snap) with position dots. Images sit on a neutral ground with
 * `mix-blend-multiply`, so white-background photos never look boxed in.
 * Callers key it by the image set, so a new set starts at the first image.
 */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const list = images.length ? images : [""]

  const goto = (i: number) => {
    setActive(i)
    const el = track.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" })
  }

  return (
    <div className="flex gap-3 lg:flex-row-reverse">
      <div className="relative min-w-0 flex-1">
        <div
          ref={track}
          className={cn("rail gap-0 overflow-x-auto rounded-[2rem] bg-surface lg:overflow-hidden", list.some(Boolean) ? "aspect-square" : "aspect-[5/2] lg:aspect-square")}
          onScroll={(e) => {
            const el = e.currentTarget
            const i = Math.round(el.scrollLeft / el.clientWidth)
            if (i !== active) setActive(i)
          }}
        >
          {list.map((src, i) => (
            <div key={i} className="grid size-full shrink-0 place-items-center">
              {src ? (
                <img
                  src={src}
                  alt={i === 0 ? title : `${title} — image ${i + 1}`}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="size-full object-contain p-[8%] mix-blend-multiply"
                />
              ) : (
                <span className="text-sm text-muted-foreground">No photo yet</span>
              )}
            </div>
          ))}
        </div>
        {list.length > 1 ? (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 lg:hidden" aria-hidden>
            {list.map((_, i) => (
              <span key={i} className={cn("h-1.5 rounded-full bg-foreground/25 transition-all", i === active ? "w-5 bg-foreground" : "w-1.5")} />
            ))}
          </div>
        ) : null}
      </div>
      {list.length > 1 ? (
        <ul className="hidden w-20 shrink-0 flex-col gap-2.5 lg:flex" aria-label="Product images">
          {list.slice(0, 7).map((src, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => goto(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === active}
                className={cn(
                  "block aspect-square w-full overflow-hidden rounded-2xl bg-surface ring-offset-2 ring-offset-background",
                  i === active ? "ring-2 ring-foreground" : "hover:ring-1 hover:ring-border",
                )}
              >
                <img src={src} alt="" className="size-full object-contain p-1.5 mix-blend-multiply" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
