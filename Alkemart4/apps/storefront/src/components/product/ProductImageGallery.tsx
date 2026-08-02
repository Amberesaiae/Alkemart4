import { useState } from "react"
import { cn } from "@/lib/utils"

type Props = {
  images: { url: string }[] | null | undefined
  title: string
  /** Processed webp full-size (preferred) */
  webUrl?: string | null
  /** Processed webp thumbnail */
  thumbUrl?: string | null
  className?: string
}

export function ProductImageGallery({
  images,
  title,
  webUrl,
  thumbUrl,
  className,
}: Props) {
  const all = images?.filter((i) => i.url) ?? []
  const [activeIdx, setActiveIdx] = useState(0)
  const active = all[activeIdx]
  const fallback = active?.url

  // Prefer processed webp derivatives where available; fall back to raw image
  const mainSrc = webUrl ?? thumbUrl ?? fallback
  const srcSet = [webUrl && `${webUrl} 1600w`, thumbUrl && `${thumbUrl} 400w`, fallback && `${fallback} 1200w`]
    .filter(Boolean)
    .join(", ")

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
        {mainSrc ? (
          <img
            src={fallback ?? mainSrc}
            srcSet={srcSet}
            sizes="(max-width: 1024px) 50vw, 40vw"
            alt={title || "Product image"}
            className="aspect-square w-full object-contain p-4 transition-opacity"
          />
        ) : (
          <div
            className="flex aspect-square flex-col items-center justify-center gap-2 bg-primary/15"
            aria-hidden
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">
              {(title || "A").trim().charAt(0).toUpperCase()}
            </span>
          </div>
        )}
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
