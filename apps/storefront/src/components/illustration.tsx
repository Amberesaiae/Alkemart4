import { cn } from "@/lib/utils"
import {
  illustration,
  type IllustrationKey,
} from "@/lib/illustrations"

type IllustrationProps = {
  name: IllustrationKey
  /** Display size — defaults to medium empty-state */
  size?: "sm" | "md" | "lg" | "xl" | "auth"
  className?: string
  imgClassName?: string
  /** Priority load for above-the-fold (auth panels) */
  priority?: boolean
  alt?: string
  /**
   * Force a light plate behind the art.
   * Default: true for silhouette pack (black+gold needs light ground).
   */
  lightPlate?: boolean
}

const SIZE_CLASS: Record<NonNullable<IllustrationProps["size"]>, string> = {
  sm: "h-24 w-24",
  md: "h-36 w-36",
  lg: "h-48 w-48",
  xl: "h-56 w-56 sm:h-64 sm:w-64",
  auth: "h-52 w-52 max-w-full sm:h-60 sm:w-60 lg:h-72 lg:w-72",
}

/**
 * Brand illustration from curated packs.
 * Silhouette art (pack 6) is black + gold on transparent — never put on black.
 */
export function Illustration({
  name,
  size = "md",
  className,
  imgClassName,
  priority = false,
  alt,
  lightPlate,
}: IllustrationProps) {
  const asset = illustration(name)
  // Cream-composited pack-6 already has a light plate — don't double-frame.
  const plate = lightPlate === true

  return (
    <div
      className={cn(
        "relative mx-auto shrink-0 select-none overflow-hidden",
        SIZE_CLASS[size],
        plate && "rounded-2xl bg-[#faf8f2] p-1",
        className,
      )}
    >
      <picture>
        <source srcSet={asset.src} type="image/webp" />
        <img
          src={asset.srcPng}
          alt={alt ?? asset.alt}
          width={asset.width}
          height={asset.height}
          decoding={priority ? "sync" : "async"}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          draggable={false}
          className={cn(
            "h-full w-full object-contain object-center",
            imgClassName,
          )}
        />
      </picture>
    </div>
  )
}
