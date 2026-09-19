import { useState } from "react"
import { cn } from "@/lib/utils"

type Props = {
  images: { url: string }[] | null | undefined
  title: string
  className?: string
}

export function ProductGallery({ images, title, className }: Props) {
  const all = images?.filter((i) => i.url) ?? []
  const [activeIdx, setActiveIdx] = useState(0)
  const active = all[activeIdx]

  if (!active) {
    return (
      <div className={cn("flex aspect-square items-center justify-center rounded-2xl border border-border bg-muted", className)}>
        <span className="text-sm font-semibold text-muted-foreground">No photo</span>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <img src={active.url} alt={title} className="aspect-square w-full object-cover" />
      </div>
      {all.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {all.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-lg border",
                i === activeIdx ? "border-primary" : "border-border",
              )}
              aria-label={`Image ${i + 1}`}
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
