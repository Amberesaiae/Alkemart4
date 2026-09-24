import { useState } from "react"
import { cn } from "@/lib/utils"
import { Icon } from "@/design/icons"
import { deptThemeClass } from "@/lib/category-theme"
import { iconForCategory } from "@/lib/catalog-nav"

type Props = {
  images: { url: string }[] | null | undefined
  title: string
  /** Processed webp full-size (preferred) */
  webUrl?: string | null
  /** Processed webp thumbnail */
  thumbUrl?: string | null
  /** Category context for the no-photo tile (same art direction as cards). */
  categoryLabel?: string | null
  categoryHandle?: string | null
  className?: string
}

function NoPhotoTile({
  title,
  categoryLabel,
  categoryHandle,
}: Pick<Props, "title" | "categoryLabel" | "categoryHandle">) {
  return (
    <div
      className={cn(
        "cat-fallback flex aspect-square w-full flex-col items-center justify-center gap-3 p-6 text-center",
        deptThemeClass(categoryLabel ?? "", categoryHandle),
      )}
      aria-hidden
    >
      <span className="cat-fallback-glyph h-20 w-20">
        <Icon
          name={iconForCategory(categoryLabel ?? "", categoryHandle)}
          size={40}
        />
      </span>
      <span className="cat-fallback-word line-clamp-2 font-semibold uppercase tracking-[0.14em]">
        {categoryLabel?.trim() || title}
      </span>
    </div>
  )
}

export function ProductImageGallery({
  images,
  title,
  webUrl,
  thumbUrl,
  categoryLabel,
  categoryHandle,
  className,
}: Props) {
  const all = images?.filter((i) => i.url) ?? []
  const [activeIdx, setActiveIdx] = useState(0)
  const active = all[activeIdx]
  const fallback = active?.url

  // Prefer processed webp derivatives for the primary photo, but show selected thumbnail when activeIdx changes
  const mainSrc = activeIdx === 0 ? (webUrl ?? fallback) : fallback

  if (!active) {
    return (
      <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
        <NoPhotoTile
          title={title}
          categoryLabel={categoryLabel}
          categoryHandle={categoryHandle}
        />
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-lg border border-border/80 bg-white">
        {mainSrc ? (
          <img
            src={mainSrc}
            alt={title || "Product image"}
            className="aspect-square w-full bg-white object-contain p-2"
          />
        ) : (
          <NoPhotoTile
            title={title}
            categoryLabel={categoryLabel}
            categoryHandle={categoryHandle}
          />
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
                "h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-white",
                i === activeIdx
                  ? "border-primary shadow-2xs"
                  : "border-border/70 hover:border-primary/60",
              )}
            >
              <img
                src={img.url}
                alt=""
                className="h-full w-full object-contain p-0.5"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
