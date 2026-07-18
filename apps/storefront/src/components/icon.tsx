import { cn } from "@/lib/utils"
import { iconAsset, type IconKey } from "@/lib/icons"

type IconProps = {
  name: IconKey
  /** ink = black mono (light UI); yellow = brand accent */
  tone?: "ink" | "yellow"
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
  alt?: string
}

const SIZE: Record<NonNullable<IconProps["size"]>, string> = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
}

/**
 * Cleaned IconScout mono icons — transparent bg, solid ink/yellow.
 * Use on light surfaces (ink) or dark chips (yellow).
 */
export function Icon({
  name,
  tone = "ink",
  size = "md",
  className,
  alt,
}: IconProps) {
  const asset = iconAsset(name, tone)
  return (
    <picture className={cn("inline-flex shrink-0", SIZE[size], className)}>
      <source srcSet={asset.src} type="image/webp" />
      <img
        src={asset.srcPng}
        alt={alt ?? asset.alt}
        width={128}
        height={128}
        decoding="async"
        loading="lazy"
        draggable={false}
        className="h-full w-full object-contain"
      />
    </picture>
  )
}
