import { color } from "@/design/tokens"
import type { IconId } from "./types"
import { cn } from "@/lib/utils"

type Props = {
  name: IconId
  size?: number
  className?: string
  /** When true, try public assets first */
  preferAsset?: boolean
  title?: string
}

/**
 * Resolve asset URL. Prefer WebP (ICONPAK2), then PNG, then SVG.
 */
function assetCandidates(name: IconId): string[] {
  return [
    `/icons/mowafer/${name}.webp`,
    `/icons/mowafer/${name}.png`,
    `/icons/mowafer/${name}.svg`,
  ]
}

/**
 * Icon primitive. Prefer user-supplied assets under public/icons/mowafer/.
 * Falls back to minimal stroke paths so layout stays pixel-stable.
 */
export function Icon({
  name,
  size = 22,
  className,
  preferAsset = true,
  title,
}: Props) {
  if (preferAsset) {
    return (
      <AssetIcon name={name} size={size} className={className} title={title} />
    )
  }
  return (
    <FallbackSvg name={name} size={size} className={className} title={title} />
  )
}

/** Always renders a geometric fallback (used when asset missing). */
export function IconFallback({
  name,
  size = 22,
  className,
  title,
}: Props) {
  return (
    <FallbackSvg name={name} size={size} className={className} title={title} />
  )
}

/**
 * Asset with SVG fallback on error.
 * IMPORTANT: never absolutely position the img without a sized box —
 * that collapsed icons to 0×0 (invisible rail / header / ATC).
 * Set preferAsset=false for pure stroke fallbacks.
 */
export function IconSafe(props: Props) {
  const { size = 22, className, name, title, preferAsset = true } = props
  if (!preferAsset) {
    return (
      <FallbackSvg name={name} size={size} className={className} title={title} />
    )
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <AssetIcon name={name} size={size} title={title} />
      <span data-icon-fallback hidden className="text-current">
        <FallbackSvg name={name} size={size} title={title} />
      </span>
    </span>
  )
}

function AssetIcon({
  name,
  size,
  className,
  title,
}: {
  name: IconId
  size: number
  className?: string
  title?: string
}) {
  const candidates = assetCandidates(name)
  return (
    <img
      src={candidates[0]}
      width={size}
      height={size}
      alt=""
      title={title}
      data-icon-name={name}
      data-icon-try={0}
      decoding="async"
      className={cn("block h-full w-full object-contain", className)}
      onError={(e) => {
        const el = e.currentTarget
        const tryIdx = Number(el.dataset.iconTry ?? "0")
        const next = candidates[tryIdx + 1]
        if (next) {
          el.dataset.iconTry = String(tryIdx + 1)
          el.src = next
          return
        }
        el.style.display = "none"
        const parent = el.parentElement
        const fb = parent?.querySelector(
          "[data-icon-fallback]",
        ) as HTMLElement | null
        if (fb) fb.hidden = false
      }}
    />
  )
}

function FallbackSvg({
  name,
  size,
  className,
  title,
}: {
  name: IconId
  size: number
  className?: string
  title?: string
}) {
  const stroke = "currentColor"
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("inline-block shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {pathFor(name)}
    </svg>
  )
}

function pathFor(name: IconId) {
  switch (name) {
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16.5 16.5 20 20" />
        </>
      )
    case "cart":
      return (
        <>
          <circle cx="9" cy="20" r="1.2" fill={color.foreground} stroke="none" />
          <circle cx="17" cy="20" r="1.2" fill={color.foreground} stroke="none" />
          <path d="M3 4h2l1.6 9.2a1.5 1.5 0 0 0 1.5 1.3h8.2a1.5 1.5 0 0 0 1.5-1.2L19 7H6.2" />
        </>
      )
    case "user":
      return (
        <>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19.5c1.6-3.2 4-4.8 6.5-4.8s4.9 1.6 6.5 4.8" />
        </>
      )
    case "heart":
      return (
        <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 4.6-7 9-7 9z" />
      )
    case "bookmark":
      /* Ribbon bookmark — outline; fill via CSS when active */
      return (
        <path d="M6.5 3.5h11A1.5 1.5 0 0 1 19 5v16.2l-7-4.1-7 4.1V5A1.5 1.5 0 0 1 6.5 3.5z" />
      )
    case "globe":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </>
      )
    case "menu":
      return (
        <>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </>
      )
    case "chevron-right":
      return <path d="m9 6 6 6-6 6" />
    case "close":
      return <path d="M6 6l12 12M18 6 6 18" />
    case "add-cart":
      return (
        <>
          <circle cx="9" cy="20" r="1" fill="currentColor" stroke="none" />
          <circle cx="17" cy="20" r="1" fill="currentColor" stroke="none" />
          <path d="M3 4h2l1.5 8h10l1.5-5H7" />
          <path d="M14 8h4M16 6v4" />
        </>
      )
    case "star":
      /* Filled yellow star — fill only, no stroke (parent svg has fill=none) */
      return (
        <path
          d="M12 2.5l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 16.98 6.3 20.06l1.09-6.35-4.62-4.5 6.38-.93L12 2.5z"
          fill="currentColor"
          stroke="none"
        />
      )
    case "star-empty":
      return (
        <path
          d="M12 2.5l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 16.98 6.3 20.06l1.09-6.35-4.62-4.5 6.38-.93L12 2.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      )
    case "star-half":
      return (
        <>
          <path
            d="M12 2.5l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 16.98 6.3 20.06l1.09-6.35-4.62-4.5 6.38-.93L12 2.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 2.5v14.48L6.3 20.06l1.09-6.35-4.62-4.5 6.38-.93L12 2.5z"
            fill="currentColor"
            stroke="none"
          />
        </>
      )
    case "filter-grid":
      return (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <rect x="13" y="13" width="7" height="7" rx="1" />
        </>
      )
    case "filter-list":
      return (
        <>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </>
      )
    case "delivery":
    case "truck":
      return (
        <>
          <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7" />
          <circle cx="7" cy="18" r="1.5" />
          <circle cx="17" cy="18" r="1.5" />
        </>
      )
    case "package":
      return (
        <>
          <path d="M12 3 4 7v10l8 4 8-4V7l-8-4z" />
          <path d="M12 12 4 7M12 12l8-5M12 12v9" />
        </>
      )
    case "location":
      return (
        <>
          <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </>
      )
    case "payment":
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
        </>
      )
    case "check":
      return <path d="m5 12 5 5L20 7" />
    case "secure":
      return (
        <>
          <path d="M12 3 5 6v5c0 5 3.5 8 7 10 3.5-2 7-5 7-10V6l-7-3z" />
        </>
      )
    case "cod":
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M8 12h8M12 9v6" />
        </>
      )
    case "world":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
        </>
      )
    case "cat-electronics":
      return (
        <>
          <rect x="6" y="4" width="12" height="16" rx="1.5" />
          <path d="M10 18h4" />
        </>
      )
    case "cat-food":
      return (
        <>
          <path d="M8 4v8a4 4 0 0 0 8 0V4" />
          <path d="M8 8h8M12 16v4" />
        </>
      )
    case "cat-beverages":
      return (
        <>
          <path d="M8 3h8l-1 14a3 3 0 0 1-6 0L8 3z" />
          <path d="M9 8h6" />
        </>
      )
    case "cat-personal-care":
      return (
        <>
          <circle cx="12" cy="8" r="3" />
          <path d="M6 20c1.5-3 3.5-4.5 6-4.5S16.5 17 18 20" />
        </>
      )
    case "cat-pet-care":
      return (
        <>
          <circle cx="8" cy="9" r="2" />
          <circle cx="16" cy="9" r="2" />
          <circle cx="12" cy="7" r="1.5" />
          <ellipse cx="12" cy="15" rx="4" ry="3" />
        </>
      )
    case "cat-baby":
      return (
        <>
          <circle cx="12" cy="9" r="3.5" />
          <path d="M7 20c1-3 3-4.5 5-4.5s4 1.5 5 4.5" />
        </>
      )
    case "cat-fashion":
      return (
        <>
          <path d="M8 4 4 8l2 1 2-1v12h8V8l2 1 2-1-4-4-2 2h-4L8 4z" />
        </>
      )
    case "cat-home":
      return (
        <>
          <path d="m4 11 8-7 8 7" />
          <path d="M6 10v10h12V10" />
        </>
      )
    case "cat-health":
      return (
        <>
          <rect x="9" y="3" width="6" height="18" rx="1" />
          <rect x="3" y="9" width="18" height="6" rx="1" />
        </>
      )
    case "cat-all":
    default:
      return (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <rect x="13" y="13" width="7" height="7" rx="1" />
        </>
      )
  }
}
