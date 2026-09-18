import { useState, type ReactNode } from "react"
import type { BadgeTone, StorefrontBadge } from "@alkemart/shared/storefront-badges"
import { Badge } from "./badge"
import { cn } from "./cn"

/**
 * A shop, as a buyer needs to judge it.
 *
 * Art, name, where it is, what people rate it, how long it takes, what it has
 * earned — then the items the vendor themselves chose to lead with. Every
 * fact is optional and every missing fact is simply absent: a shop nobody has
 * reviewed shows no rating, a shop that has declared no band shows no time.
 *
 * Shared so the storefront, the vendor's own preview and the Studio all draw
 * the same card and cannot drift.
 */

export type StoreCardFeatured = {
  productId: string
  title: string
  imageUrl: string | null
  fromPricePesewas: string
}

export type StoreCardData = {
  id: string
  handle: string
  name: string
  logo?: string | null
  banner?: string | null
  tagline?: string | null
  location?: string | null
  availability?: "open" | "paused"
  ratingAvg?: number | null
  ratingCount?: number
  deliveryMinutes?: number | null
  badges?: StorefrontBadge[]
  featured?: StoreCardFeatured[]
}

/** Badge tones map onto the app's existing `--tone-*` ramp, not new colours. */
const TONE: Record<BadgeTone, { tone: "brand" | "success" | "warning" | "neutral"; emphasis: "solid" | "soft" }> = {
  earned: { tone: "brand", emphasis: "solid" },
  good: { tone: "success", emphasis: "soft" },
  warn: { tone: "warning", emphasis: "soft" },
  neutral: { tone: "neutral", emphasis: "soft" },
}

/** At most this many badges on a card — one that shows everything shows nothing. */
const MAX_BADGES = 2

export function StoreCardBadges({ badges, max = MAX_BADGES, className }: {
  badges?: StorefrontBadge[]
  max?: number
  className?: string
}) {
  const shown = (badges ?? []).slice(0, max)
  if (shown.length === 0) return null
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {shown.map((b) => {
        const t = TONE[b.tone]
        return (
          <Badge key={b.id} tone={t.tone} emphasis={t.emphasis} data-badge={b.id}>
            {b.label}
          </Badge>
        )
      })}
    </div>
  )
}

/**
 * Rating and delivery band on one line, separated only when both exist.
 *
 * Takes the three facts rather than a whole card, so any shape carrying them
 * (a store DTO, a vendor preview, a search suggestion) can render this row.
 */
export function StoreCardFacts({ store, className }: {
  store: Pick<StoreCardData, "ratingAvg" | "ratingCount" | "deliveryMinutes">
  className?: string
}) {
  const hasRating =
    store.ratingAvg != null && Number.isFinite(store.ratingAvg) && (store.ratingCount ?? 0) > 0
  const minutes =
    store.deliveryMinutes != null && Number.isFinite(store.deliveryMinutes) && store.deliveryMinutes > 0
      ? store.deliveryMinutes
      : null
  if (!hasRating && minutes == null) return null

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-xs tabular-nums text-muted-foreground",
        className,
      )}
    >
      {hasRating ? (
        <span
          className="inline-flex shrink-0 items-center gap-1"
          aria-label={`Rated ${store.ratingAvg!.toFixed(1)} out of 5 from ${store.ratingCount} ${
            store.ratingCount === 1 ? "review" : "reviews"
          }`}
        >
          <StarGlyph />
          <span className="font-semibold text-foreground">{store.ratingAvg!.toFixed(1)}</span>
          <span aria-hidden>({store.ratingCount})</span>
        </span>
      ) : null}
      {hasRating && minutes != null ? <span aria-hidden>·</span> : null}
      {minutes != null ? <span className="shrink-0">{minutes} min delivery</span> : null}
    </div>
  )
}

function StarGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden className="shrink-0 text-primary">
      <path
        d="M12 2.5l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 16.98 6.3 20.06l1.09-6.35-4.62-4.5 6.38-.93L12 2.5z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * Banner art with a shimmer at the true aspect ratio.
 *
 * The card carries no text over the art, so an unloaded banner would be a
 * silent grey box; the shimmer says "coming" and holds the layout so nothing
 * shifts when the image lands.
 */
export function StoreCardArt({ src, alt = "", fallback, className }: {
  src?: string | null
  alt?: string
  fallback?: ReactNode
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <span className={cn("relative block w-full overflow-hidden bg-muted", className)}>
      {src ? (
        <>
          {!loaded ? <span className="merch-shimmer absolute inset-0 z-0 block" aria-hidden /> : null}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
            className={cn(
              "absolute inset-0 z-[1] h-full w-full object-cover transition duration-500",
              "group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      ) : (
        <span className="absolute inset-0 z-0 flex items-center justify-center opacity-40" aria-hidden>
          {fallback}
        </span>
      )}
    </span>
  )
}

/**
 * The vendor's own picks, as a compact strip.
 *
 * Deliberately art and price only. These tiles exist to show what a shop
 * sells at a glance, not to compete with the product grid inside the shop.
 */
export function StoreCardFeaturedStrip({ items, renderItem, className }: {
  items?: StoreCardFeatured[]
  /** Surfaces supply their own link element (router Link vs inert preview). */
  renderItem: (item: StoreCardFeatured) => ReactNode
  className?: string
}) {
  const shown = (items ?? []).slice(0, 8)
  if (shown.length === 0) return null
  return (
    <div
      className={cn("scrollbar-none flex gap-1.5 overflow-x-auto", className)}
      role="list"
      aria-label="Picked by this shop"
    >
      {shown.map((item) => (
        <div role="listitem" key={item.productId} className="shrink-0">
          {renderItem(item)}
        </div>
      ))}
    </div>
  )
}

export const storeCardShell = cn(
  "group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card",
  "shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
)
