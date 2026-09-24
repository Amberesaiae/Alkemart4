import { useEffect, useState, useRef, useCallback, type ReactNode } from "react"
import { ArrowRight, CaretLeft, CaretRight, Pause, Play } from "@phosphor-icons/react"
import { countdownParts, timeRemaining } from "@alkemart/shared/homepage"
import { cn } from "./cn"

export type MerchTheme = "white" | "gold" | "black"

function themeClass(theme: MerchTheme) {
  if (theme === "gold") return "bg-primary text-black"
  if (theme === "black") return "bg-black text-white"
  return "border border-black/10 bg-white text-black"
}

/**
 * Shared section header — the visual-clarity contract.
 * Every grid/shelf on the homepage and in Homepage Studio uses this,
 * so title / subtitle / action alignment never drifts between surfaces.
 */
export function MerchSectionHeader({ eyebrow, title, subtitle, action, align = "between", className }: {
  eyebrow?: string
  title: string
  subtitle?: string
  action?: ReactNode
  align?: "between" | "start"
  className?: string
}) {
  return (
    <div className={cn(align === "between" ? "flex items-end justify-between gap-3" : "space-y-1", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-60">{eyebrow}</p> : null}
        <h2 className="text-2xl font-bold">{title}</h2>
        {subtitle ? <p className="max-w-2xl text-sm leading-6 opacity-70">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0 text-sm font-bold">{action}</div> : null}
    </div>
  )
}

export function MerchPromoHero({ eyebrow, title, subtitle, body, imageUrl, action, theme, layout = "split", interactive = true, compact = false, className }: {
  eyebrow?: string
  title: string
  subtitle?: string
  body?: string
  imageUrl?: string
  action?: { label: string; href: string }
  theme: MerchTheme
  layout?: "split" | "band"
  interactive?: boolean
  compact?: boolean
  className?: string
}) {
  const actionNode = action ? (
    <span className={cn("mt-6 inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 text-sm font-bold", theme === "black" ? "bg-primary text-black" : "bg-black text-white")}>
      {action.label}<ArrowRight className="h-4 w-4" />
    </span>
  ) : null
  if (layout === "band") {
    return (
      <section className={cn("relative overflow-hidden rounded-lg", themeClass(theme), compact ? "p-6" : "p-7 sm:p-10", className)}>
        {imageUrl ? <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden="true" /> : null}
        <div className="relative z-10 max-w-2xl">
          {eyebrow ? <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] opacity-65">{eyebrow}</p> : null}
          <h2 className={cn("font-bold leading-[1.02] tracking-tight", compact ? "text-2xl" : "text-3xl sm:text-4xl")}>{title}</h2>
          {subtitle ? <p className="mt-2 text-sm font-semibold opacity-80 sm:text-base">{subtitle}</p> : null}
          {body ? <p className="mt-3 max-w-xl text-sm leading-6 opacity-75">{body}</p> : null}
          {actionNode && interactive ? <a href={action!.href}>{actionNode}</a> : actionNode}
        </div>
      </section>
    )
  }
  return (
    <section className={cn("grid overflow-hidden rounded-lg sm:grid-cols-2", compact ? "min-h-52" : "min-h-[300px]", themeClass(theme), className)}>
      <div className={cn("flex flex-col justify-center", compact ? "p-6" : "p-7 sm:p-10 lg:p-14")}>
        {eyebrow ? <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] opacity-65">{eyebrow}</p> : null}
        <h2 className={cn("font-bold leading-[1.02] tracking-tight", compact ? "text-2xl" : "text-3xl sm:text-4xl lg:text-5xl")}>{title}</h2>
        {subtitle ? <p className="mt-2 text-sm font-semibold opacity-80 sm:text-base">{subtitle}</p> : null}
        {body ? <p className="mt-4 max-w-lg text-sm leading-6 opacity-75 sm:text-base">{body}</p> : null}
        {actionNode && interactive ? <a href={action!.href}>{actionNode}</a> : actionNode}
      </div>
      <div className={cn("bg-white/35 bg-cover bg-center", compact ? "min-h-36" : "min-h-[240px]")} style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined} aria-hidden="true" />
    </section>
  )
}

export function MerchPromoGrid({ title, subtitle, eyebrow, columns, theme, variant = "cards", tiles, interactive = true, compact = false, className }: {
  title?: string
  subtitle?: string
  eyebrow?: string
  columns: 2 | 3 | 4
  theme: MerchTheme
  variant?: "cards" | "bento" | "walmart" | "editorial"
  tiles: Array<{ id: string; title: string; eyebrow?: string; body?: string; imageUrl?: string; href: string }>
  interactive?: boolean
  compact?: boolean
  className?: string
}) {
  const gridClass = variant === "walmart"
    ? "grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
    : variant === "editorial"
      ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      : variant === "bento"
      ? "grid gap-3 sm:grid-cols-3"
      : cn("grid gap-3", columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4")
  return (
    <section className={cn("space-y-4", className)}>
      {title || subtitle || eyebrow ? <MerchSectionHeader eyebrow={eyebrow} title={title ?? ""} subtitle={subtitle} /> : null}
      <div className={gridClass}>
        {tiles.map((tile, index) => {
          if (variant === "editorial") {
            // Editorial tile — Walmart pattern: art on top, display caption
            // below on paper. No scrim, no overlay; the type scale (large
            // bold headline + underlined shop link) is what carries it.
            const editorial = (
              <div className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/5">
                  {tile.imageUrl ? (
                    <img
                      src={tile.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col items-start gap-1 p-4 sm:p-5">
                  {tile.eyebrow ? (
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{tile.eyebrow}</p>
                  ) : null}
                  <p className="text-xl font-bold leading-tight text-foreground">{tile.title}</p>
                  {tile.body ? <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{tile.body}</p> : null}
                  <span className="mt-1.5 text-sm font-bold text-foreground underline underline-offset-4">
                    Shop now
                  </span>
                </div>
              </div>
            )
            return interactive ? (
              <a key={tile.id} href={tile.href}>{editorial}</a>
            ) : (
              <div key={tile.id}>{editorial}</div>
            )
          }
          const isWalmartHero = variant === "walmart" && (index === 0 || index === tiles.length - 1)
          const card = (
            <div className={cn(
              "group relative overflow-hidden rounded-lg p-5 flex flex-col justify-end shadow-2xs",
              compact ? "min-h-28" : variant === "bento" && index === 0 ? "min-h-64 sm:col-span-2 sm:row-span-2" : isWalmartHero ? "min-h-[320px] lg:min-h-[360px]" : "min-h-52",
              themeClass(theme),
            )}>
              <div className="absolute inset-0 bg-cover bg-center" style={tile.imageUrl ? { backgroundImage: `url(${tile.imageUrl})` } : undefined} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="relative z-10 flex h-full flex-col justify-end text-white">
                {tile.eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{tile.eyebrow}</p> : null}
                <p className={cn("font-bold", isWalmartHero ? "text-2xl sm:text-3xl" : "text-xl")}>{tile.title}</p>
                {tile.body ? <p className="mt-1 text-sm text-white/80 line-clamp-2">{tile.body}</p> : null}
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary underline-offset-2 group-hover:underline">
                  Shop now &rarr;
                </span>
              </div>
            </div>
          )
          return interactive ? <a key={tile.id} href={tile.href} aria-label={tile.title}>{card}</a> : <div key={tile.id}>{card}</div>
        })}
      </div>
    </section>
  )
}

/**
 * Promo / advertise band — the manageable replacement for the old
 * code-defined `HomeAdvertiseBand`. Same visual job (compact CTA strip),
 * but admin-configurable with theme + primary/secondary actions.
 */
export function MerchPromoBand({ eyebrow, title, body, imageUrl, action, secondaryAction, theme, layout = "split", focalPoint, interactive = true, compact = false, scrim = "strong", className }: {
  eyebrow?: string
  title: string
  body?: string
  imageUrl?: string
  action?: { label: string; href: string }
  secondaryAction?: { label: string; href: string }
  theme: MerchTheme
  /** `cover` renders band-made art full-bleed with scrimmed overlay copy. */
  layout?: "split" | "cover"
  /** CSS object-position for the cover crop. */
  focalPoint?: string
  interactive?: boolean
  compact?: boolean
  /** Cover scrim strength — `none` for art with flat space for copy. */
  scrim?: "strong" | "soft" | "none"
  className?: string
}) {
  const primary = action ? (
    <span className={cn("inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold", theme === "gold" ? "bg-black text-white" : "bg-primary text-black")}>
      {action.label}<ArrowRight className="ml-2 h-4 w-4" />
    </span>
  ) : null
  const secondary = secondaryAction ? (
    <span className="text-sm font-bold underline underline-offset-2">{secondaryAction.label}</span>
  ) : null
  if (layout === "cover" && imageUrl) {
    return (
      <section className={cn("relative overflow-hidden rounded-lg", className)} aria-label={title}>
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={focalPoint ? { objectPosition: focalPoint } : undefined}
        />
        <div
          className={cn(
            "absolute inset-0",
            scrim === "none"
              ? ""
              : scrim === "soft"
                ? "bg-gradient-to-r from-black/40 via-transparent to-transparent"
                : "bg-gradient-to-r from-black/65 via-black/25 to-transparent",
          )}
          aria-hidden="true"
        />
        <div className={cn(
          "relative flex max-w-xl flex-col items-start justify-center gap-2",
          compact ? "min-h-32 p-5 sm:min-h-40 sm:p-6" : "min-h-44 p-6 sm:min-h-52 sm:p-8",
        )}>
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
          <h2 className={cn("font-bold leading-tight text-white", compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl")}>{title}</h2>
          {body ? <p className="max-w-md text-sm leading-6 text-white/80">{body}</p> : null}
          {action || secondaryAction ? (
            <div className="mt-1 flex flex-wrap items-center gap-4">
              {primary && interactive && action ? <a href={action.href}>{primary}</a> : primary}
              {secondary && interactive && secondaryAction ? (
                <a href={secondaryAction.href} className="text-white">{secondary}</a>
              ) : (
                <span className="text-white">{secondary}</span>
              )}
            </div>
          ) : null}
        </div>
      </section>
    )
  }
  return (
    <section className={cn("relative overflow-hidden rounded-lg", themeClass(theme), compact ? "px-5 py-5" : "px-6 py-6 sm:px-8", className)} aria-label={title}>
      {imageUrl ? <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden="true" /> : null}
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-65">{eyebrow}</p> : null}
          <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
          {body ? <p className="max-w-xl text-sm leading-6 opacity-75">{body}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4">
          {primary && interactive && action ? <a href={action.href}>{primary}</a> : primary}
          {secondary && interactive && secondaryAction ? <a href={secondaryAction.href}>{secondary}</a> : secondary}
        </div>
      </div>
    </section>
  )
}

export type MerchCategoryVariant = "tiles" | "mosaic" | "rail" | "banner"
export type MerchCategoryRatio = "square" | "landscape" | "wide" | "ultrawide"

/**
 * Banner proportions. Sizing is always a ratio — never a fixed height — so a
 * category banner stays a banner instead of growing into an oversized card.
 * On desktop the mosaic overrides these: tiles stretch to share the row.
 */
export const merchRatioClass: Record<MerchCategoryRatio, string> = {
  square: "aspect-square",
  landscape: "aspect-[5/4] sm:aspect-[4/3]",
  wide: "aspect-[3/2]",
  ultrawide: "aspect-[16/9] sm:aspect-[16/5]",
}

/**
 * Layout for one category tile — the wrapper that stacks art over caption.
 * Returned as a class string so each surface supplies its own element: the
 * storefront a router `Link`, the Studio preview an inert `div`.
 *
 * Proportion is no longer set here. The caption sits outside the art, so the
 * aspect ratio belongs to the art frame inside `MerchCategoryTileBody`, which
 * takes `ratio` directly.
 */
export function merchCategoryTileClass({ variant = "tiles", feature = false, className }: {
  variant?: MerchCategoryVariant
  /** @deprecated pass `ratio` to MerchCategoryTileBody — it sizes the art. */
  ratio?: MerchCategoryRatio
  feature?: boolean
  className?: string
}) {
  return cn(
    "group flex flex-col gap-2 rounded-lg",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
    variant === "rail" && "w-36 shrink-0 snap-start sm:w-44",
    // Desktop mosaic: feature tiles claim both rows and every tile fills its
    // cell, which is what restores the two-large / two-small composition.
    variant === "mosaic" && "lg:h-full",
    variant === "mosaic" && feature && "lg:row-span-2",
    variant === "banner" && feature && "lg:col-span-2",
    className,
  )
}

/**
 * A category tile is its artwork, and nothing else.
 *
 * The old tile burned a 65%-black scrim, an uppercase label, an eyebrow and a
 * badge over every upload, so no photograph could ever be seen and every tile
 * fought its own art. Here the art fills the frame untouched and the wording
 * sits underneath in the page's own type — which is also more accessible,
 * because the caption becomes the link's accessible name instead of being
 * decorative text over an unlabelled image.
 *
 * Until the art decodes the frame holds a shimmer at its true aspect ratio,
 * so an art-only tile is never a silent empty box and nothing shifts on load.
 * `fallback` still renders when no art is configured at all.
 */
export function MerchCategoryTileBody({ label, badge, imageUrl, focalPoint, imageClassName, fallback, variant = "tiles", ratio = "square" }: {
  label: string
  /** @deprecated art carries no text; kept out of the frame entirely. */
  eyebrow?: string
  /** Rendered beside the caption, never over the art. */
  badge?: string
  imageUrl?: string
  /** CSS object-position from the Studio, e.g. "center" or "50% 30%". */
  focalPoint?: string
  /** Crop class from canonical category art, e.g. "object-[center_20%]". */
  imageClassName?: string
  /** @deprecated size comes from the tile's grid cell; captions stay uniform. */
  feature?: boolean
  fallback?: ReactNode
  variant?: MerchCategoryVariant
  ratio?: MerchCategoryRatio
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [imageUrl])

  const showArt = Boolean(imageUrl) && !failed

  return (
    <>
      <span
        className={cn(
          "relative block w-full overflow-hidden rounded-lg bg-black/5",
          "ring-1 ring-black/[0.06] shadow-sm",
          merchRatioClass[ratio],
          // Desktop mosaic sizes by the grid row, not by ratio.
          variant === "mosaic" && "lg:aspect-auto lg:min-h-0 lg:flex-1",
        )}
      >
        {showArt ? (
          <>
            {!loaded ? (
              <span className="merch-shimmer absolute inset-0 z-0 block" aria-hidden="true" />
            ) : null}
            <img
              src={imageUrl}
              alt=""
              width={1400}
              height={1400}
              decoding="async"
              loading="lazy"
              draggable={false}
              onLoad={() => setLoaded(true)}
              onError={() => { setFailed(true); setLoaded(true) }}
              style={focalPoint ? { objectPosition: focalPoint } : undefined}
              className={cn(
                "absolute inset-0 z-[1] h-full w-full object-cover",
                loaded ? "opacity-100" : "opacity-0",
                focalPoint ? undefined : imageClassName,
              )}
            />
          </>
        ) : (
          <span className="absolute inset-0 z-0 flex items-center justify-center opacity-40" aria-hidden="true">
            {fallback}
          </span>
        )}
      </span>

      {/* One caption size for every tile in a grid. Varying it by `feature`
          changes the caption's height, which steals height from the art frame
          and leaves neighbouring tiles misaligned by a couple of pixels. Size
          is already how a feature tile reads as a feature. */}
      <span className="flex min-w-0 shrink-0 items-center gap-2 px-0.5">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug">
          {label}
        </span>
        {badge ? (
          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-black">
            {badge}
          </span>
        ) : null}
      </span>
    </>
  )
}

export function MerchGridSection({ title, subtitle, eyebrow, action, columns, variant = "tiles", children, className }: {
  title: string
  subtitle?: string
  eyebrow?: string
  action?: ReactNode
  columns: 4 | 6 | 8
  variant?: MerchCategoryVariant
  children: ReactNode
  className?: string
}) {
  if (variant === "rail") {
    return (
      <section className={cn("space-y-4", className)}>
        <MerchSectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} action={action} />
        <div className="flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory]" role="list">{children}</div>
      </section>
    )
  }
  return (
    <section className={cn("space-y-4", className)}>
      <MerchSectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} action={action} />
      <div className={cn(
        "grid gap-2.5 sm:gap-3 lg:gap-4",
        // Mosaic is the editorial hierarchy: two feature tiles stand tall beside
        // a stack of standard ones, the row capped so it never becomes a tower.
        // Bento belongs on editorial surfaces — never product listings.
        variant === "mosaic"
          ? "grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 lg:h-[min(440px,50vw)] lg:min-h-[420px]"
          : variant === "banner"
            ? "grid-cols-1 lg:grid-cols-2"
            : columns === 4 ? "grid-cols-2 sm:grid-cols-4" : columns === 6 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-4 sm:grid-cols-8",
      )}>{children}</div>
    </section>
  )
}

export function MerchShelf({ title, subtitle, eyebrow, action, layout = "grid", children, className }: {
  title: string
  subtitle?: string
  eyebrow?: string
  action?: ReactNode
  layout?: "grid" | "carousel"
  children: ReactNode
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current) return
    const offset = direction === "left" ? -360 : 360
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" })
  }, [])

  return (
    <section className={cn("space-y-3.5", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-60">{eyebrow}</p> : null}
          <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
          {subtitle ? <p className="max-w-2xl text-xs sm:text-sm leading-snug opacity-70">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {action ? <div className="shrink-0 text-sm font-bold">{action}</div> : null}
          {layout === "carousel" ? (
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => scroll("left")}
                aria-label="Scroll left"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-foreground shadow-2xs hover:bg-black/5 dark:bg-card dark:border-white/10"
              >
                <CaretLeft size={16} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                aria-label="Scroll right"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-foreground shadow-2xs hover:bg-black/5 dark:bg-card dark:border-white/10"
              >
                <CaretRight size={16} weight="bold" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {layout === "carousel" ? (
        <div
          ref={scrollRef}
          className="scrollbar-none flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory] -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {children}
        </div>
      ) : (
        <>{children}</>
      )}
    </section>
  )
}

/**
 * Live countdown. Ticks once a second while mounted and stops at zero.
 * Rendered as a single `time` element with a readable `dateTime`, so assistive
 * tech gets the deadline itself rather than a stream of changing digits.
 */
export function MerchCountdown({ to, expiredLabel = "Offer ended", compact = false, className }: {
  to: string
  expiredLabel?: string
  compact?: boolean
  className?: string
}) {
  const [remaining, setRemaining] = useState(() => timeRemaining(to))

  useEffect(() => {
    setRemaining(timeRemaining(to))
    const timer = setInterval(() => setRemaining(timeRemaining(to)), 1000)
    return () => clearInterval(timer)
  }, [to])

  if (remaining === null) return null
  if (remaining === 0) {
    return <p className={cn("text-sm font-bold opacity-70", className)}>{expiredLabel}</p>
  }

  const parts = countdownParts(remaining)
  const cells: Array<[number, string]> = [
    [parts.days, "days"],
    [parts.hours, "hrs"],
    [parts.minutes, "min"],
    [parts.seconds, "sec"],
  ]
  const shown = parts.days > 0 ? cells.slice(0, 3) : cells.slice(1)

  return (
    <time
      dateTime={to}
      // The ticking digits are decorative; the deadline is the fact.
      aria-label={`Ends in ${shown.map(([value, unit]) => `${value} ${unit}`).join(", ")}`}
      className={cn("flex items-center gap-1.5", className)}
    >
      {shown.map(([value, unit]) => (
        <span
          key={unit}
          aria-hidden="true"
          className={cn(
            "flex min-w-11 flex-col items-center rounded-lg bg-black/85 px-2 py-1 text-white",
            compact && "min-w-9 px-1.5 py-0.5",
          )}
        >
          <span className={cn("font-bold tabular-nums leading-none", compact ? "text-sm" : "text-lg")}>
            {String(value).padStart(2, "0")}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{unit}</span>
        </span>
      ))}
    </time>
  )
}

/**
 * Countdown banner — a deal with a deadline. The clock is the point, so it
 * leads the layout rather than hiding beside the copy.
 */
export function MerchCountdownBanner({ eyebrow, title, body, countdownTo, expiredLabel, imageUrl, action, theme, interactive = true, compact = false, className }: {
  eyebrow?: string
  title: string
  body?: string
  countdownTo: string
  expiredLabel?: string
  imageUrl?: string
  action?: { label: string; href: string }
  theme: MerchTheme
  interactive?: boolean
  compact?: boolean
  className?: string
}) {
  const cta = action ? (
    <span className={cn("inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold", theme === "gold" ? "bg-black text-white" : "bg-primary text-black")}>
      {action.label}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
    </span>
  ) : null
  return (
    <section className={cn("relative overflow-hidden rounded-lg", themeClass(theme), compact ? "px-5 py-5" : "px-6 py-7 sm:px-8", className)} aria-label={title}>
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-20" />
      ) : null}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-65">{eyebrow}</p> : null}
          <h2 className={cn("font-bold", compact ? "text-xl" : "text-2xl sm:text-3xl")}>{title}</h2>
          {body ? <p className="max-w-xl text-sm leading-6 opacity-75">{body}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <MerchCountdown to={countdownTo} expiredLabel={expiredLabel} compact={compact} />
          {cta && interactive && action ? <a href={action.href}>{cta}</a> : cta}
        </div>
      </div>
    </section>
  )
}

/**
 * Announcement marquee.
 *
 * Motion is opt-in and always pausable: WCAG 2.2.2 requires a stop control for
 * anything that moves for more than five seconds, and `prefers-reduced-motion`
 * drops it to a static strip. Without motion it is simply a list of links,
 * which is what screen readers and reduced-motion users get either way.
 */
export function MerchMarquee({ items, theme, animated = true, speed = "normal", interactive = true, className }: {
  items: Array<{ id: string; label: string; href?: string }>
  theme: MerchTheme
  animated?: boolean
  speed?: "slow" | "normal"
  interactive?: boolean
  className?: string
}) {
  const [paused, setPaused] = useState(false)
  if (!items.length) return null
  const moving = animated && interactive
  const content = items.map((item) => (
    <span key={item.id} className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 text-sm font-bold">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
      {item.href && interactive ? <a href={item.href} className="underline-offset-2 hover:underline">{item.label}</a> : item.label}
    </span>
  ))
  return (
    <section className={cn("relative overflow-hidden rounded-lg py-2.5", themeClass(theme), className)} aria-label="Announcements">
      <div className="flex items-center">
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center",
            moving ? "merch-marquee-track" : "flex-wrap gap-y-1",
            moving && speed === "slow" && "merch-marquee-slow",
            paused && "merch-marquee-paused",
          )}
        >
          {content}
          {moving ? <span aria-hidden="true" className="flex">{content}</span> : null}
        </div>
        {moving ? (
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            aria-pressed={paused}
            aria-label={paused ? "Resume scrolling announcements" : "Pause scrolling announcements"}
            className="mr-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Deal rail — a shelf with campaign framing: eyebrow, per-card badge and an
 * optional clock. Products are the caller's; this only supplies the frame,
 * and it never claims a discount the catalogue cannot substantiate.
 */
export function MerchDealRail({ title, subtitle, eyebrow, countdownTo, action, children, className }: {
  title: string
  subtitle?: string
  eyebrow?: string
  countdownTo?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-4 rounded-lg bg-black/[0.03] p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-60">{eyebrow}</p> : null}
          <h2 className="text-2xl font-bold">{title}</h2>
          {subtitle ? <p className="max-w-2xl text-sm leading-6 opacity-70">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {countdownTo ? <MerchCountdown to={countdownTo} compact /> : null}
          {action}
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory]">{children}</div>
    </section>
  )
}

/** Corner flag for a deal card, e.g. "Flash deal". */
export function MerchDealBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("absolute left-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-black shadow-sm", className)}>
      {label}
    </span>
  )
}

export function MerchValueGrid({ title, subtitle, items, compact = false, className }: {
  title?: string
  subtitle?: string
  items: Array<{ id: string; title: string; body: string }>
  compact?: boolean
  className?: string
}) {
  return (
    <section className={cn("rounded-lg bg-black text-white", compact ? "p-5" : "p-6 sm:p-8", className)}>
      {title ? <h2 className="text-2xl font-bold">{title}</h2> : null}
      {subtitle ? <p className="mt-1 text-sm text-white/65">{subtitle}</p> : null}
      <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", title || subtitle ? "mt-5" : "")}>
        {items.map((item) => (
          <article key={item.id} className="rounded-lg border border-white/15 p-5">
            <span className="mb-4 block h-3 w-3 rounded-full bg-primary" />
            <h3 className="font-bold">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-white/65">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

/**
 * Empty-state panel — used when a shelf resolves to zero products or an
 * admin previews a section with no configured source. Honest, never fake.
 */
export function MerchEmpty({ title, body, action, className }: {
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-lg border border-dashed border-black/15 bg-white p-6 text-center", className)} role="status">
      <p className="font-bold">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-md text-sm text-black/60">{body}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
