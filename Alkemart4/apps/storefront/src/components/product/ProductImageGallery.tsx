import { useState } from "react"
import { cn } from "@/lib/utils"

type Props = {
  images: { url: string }[] | null | undefined
  title: string
  className?: string
}

export function ProductImageGallery({ images, title, className }: Props) {
  const all = images?.filter((i) => i.url) ?? []
  const [activeIdx, setActiveIdx] = useState(0)
  const active = all[activeIdx]

  if (!active) {
    return (
      <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
        <div
          className="flex aspect-square flex-col items-center justify-center gap-2 bg-primary/15"
          aria-hidden
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">
            {(title || "A").trim().charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <img
          src={active.url}
          alt={title || "Product image"}
          className="aspect-square w-full object-contain p-4 transition-opacity"
        />
      </div>

      {all.length > 1 ? (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Product images"
        >
          {all.map((img, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIdx}
              aria-label={`View image ${i + 1}`}
              onClick={() => setActiveIdx(i)}
              className={cn(
                "h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted transition-colors",
                i === activeIdx
                  ? "border-primary"
                  : "border-transparent hover:border-border",
              )}
            >
              <img
                src={img.url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
