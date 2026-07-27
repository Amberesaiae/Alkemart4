import { cn } from "@workspace/ui"

type ProductThumbnailProps = {
  src?: string | null
  alt: string
  className?: string
  size?: "sm" | "md" | "lg"
}

const sizeClass = {
  sm: "h-12 w-12 rounded-lg",
  md: "h-16 w-16 rounded-xl",
  lg: "aspect-square w-full rounded-2xl",
} as const

function ProductThumbnail({ src, alt, className, size = "md" }: ProductThumbnailProps) {
  if (!src) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center border border-dashed border-border bg-muted text-[10px] text-muted-foreground", sizeClass[size], className)}>
        —
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className={cn("shrink-0 border border-border object-cover bg-muted", sizeClass[size], className)}
      decoding="async"
      loading="lazy"
    />
  )
}
export { ProductThumbnail }
