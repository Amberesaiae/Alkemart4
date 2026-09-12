import type { ReactNode } from "react"
import { ArrowRight } from "@phosphor-icons/react"
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
        {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] opacity-60">{eyebrow}</p> : null}
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
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
      <section className={cn("relative overflow-hidden rounded-3xl", themeClass(theme), compact ? "p-6" : "p-7 sm:p-10", className)}>
        {imageUrl ? <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden="true" /> : null}
        <div className="relative z-10 max-w-2xl">
          {eyebrow ? <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] opacity-65">{eyebrow}</p> : null}
          <h2 className={cn("font-black leading-[1.02] tracking-tight", compact ? "text-2xl" : "text-3xl sm:text-4xl")}>{title}</h2>
          {subtitle ? <p className="mt-2 text-sm font-semibold opacity-80 sm:text-base">{subtitle}</p> : null}
          {body ? <p className="mt-3 max-w-xl text-sm leading-6 opacity-75">{body}</p> : null}
          {actionNode && interactive ? <a href={action!.href}>{actionNode}</a> : actionNode}
        </div>
      </section>
    )
  }
  return (
    <section className={cn("grid overflow-hidden rounded-3xl sm:grid-cols-2", compact ? "min-h-52" : "min-h-[300px]", themeClass(theme), className)}>
      <div className={cn("flex flex-col justify-center", compact ? "p-6" : "p-7 sm:p-10 lg:p-14")}>
        {eyebrow ? <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] opacity-65">{eyebrow}</p> : null}
        <h2 className={cn("font-black leading-[1.02] tracking-tight", compact ? "text-2xl" : "text-3xl sm:text-4xl lg:text-5xl")}>{title}</h2>
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
  variant?: "cards" | "bento"
  tiles: Array<{ id: string; title: string; eyebrow?: string; body?: string; imageUrl?: string; href: string }>
  interactive?: boolean
  compact?: boolean
  className?: string
}) {
  const gridClass = variant === "bento"
    ? "grid gap-3 sm:grid-cols-3"
    : cn("grid gap-3", columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4")
  return (
    <section className={cn("space-y-4", className)}>
      {title || subtitle || eyebrow ? <MerchSectionHeader eyebrow={eyebrow} title={title ?? ""} subtitle={subtitle} /> : null}
      <div className={gridClass}>
        {tiles.map((tile, index) => {
          const card = (
            <div className={cn(
              "group relative overflow-hidden rounded-2xl p-5",
              compact ? "min-h-28" : variant === "bento" && index === 0 ? "min-h-64 sm:col-span-2 sm:row-span-2" : "min-h-52",
              themeClass(theme),
            )}>
              <div className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-[1.03]" style={tile.imageUrl ? { backgroundImage: `url(${tile.imageUrl})` } : undefined} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
              <div className="relative z-10 flex h-full flex-col justify-end text-white">
                {tile.eyebrow ? <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/70">{tile.eyebrow}</p> : null}
                <p className="text-xl font-black">{tile.title}</p>
                {tile.body ? <p className="mt-1 text-sm text-white/80">{tile.body}</p> : null}
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
export function MerchPromoBand({ eyebrow, title, body, imageUrl, action, secondaryAction, theme, interactive = true, compact = false, className }: {
  eyebrow?: string
  title: string
  body?: string
  imageUrl?: string
  action?: { label: string; href: string }
  secondaryAction?: { label: string; href: string }
  theme: MerchTheme
  interactive?: boolean
  compact?: boolean
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
  return (
    <section className={cn("relative overflow-hidden rounded-2xl", themeClass(theme), compact ? "px-5 py-5" : "px-6 py-6 sm:px-8", className)} aria-label={title}>
      {imageUrl ? <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden="true" /> : null}
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] opacity-65">{eyebrow}</p> : null}
          <h2 className="text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
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

export function MerchGridSection({ title, subtitle, eyebrow, action, columns, variant = "tiles", children, className }: {
  title: string
  subtitle?: string
  eyebrow?: string
  action?: ReactNode
  columns: 4 | 6 | 8
  variant?: "tiles" | "mosaic" | "rail"
  children: ReactNode
  className?: string
}) {
  if (variant === "rail") {
    return (
      <section className={cn("space-y-4", className)}>
        <MerchSectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} action={action} />
        <div className="flex gap-3 overflow-x-auto pb-2" role="list">{children}</div>
      </section>
    )
  }
  return (
    <section className={cn("space-y-4", className)}>
      <MerchSectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} action={action} />
      <div className={cn(
        "grid gap-3",
        variant === "mosaic" ? "grid-cols-2 lg:grid-cols-3" : columns === 4 ? "grid-cols-2 sm:grid-cols-4" : columns === 6 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-4 sm:grid-cols-8",
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
  return (
    <section className={cn("space-y-4", className)}>
      <MerchSectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} action={action} />
      {layout === "carousel"
        ? <div className="flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory]">{children}</div>
        : <>{children}</>}
    </section>
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
    <section className={cn("rounded-3xl bg-black text-white", compact ? "p-5" : "p-6 sm:p-8", className)}>
      {title ? <h2 className="text-2xl font-black">{title}</h2> : null}
      {subtitle ? <p className="mt-1 text-sm text-white/65">{subtitle}</p> : null}
      <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", title || subtitle ? "mt-5" : "")}>
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-white/15 p-5">
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
    <div className={cn("rounded-2xl border border-dashed border-black/15 bg-white p-6 text-center", className)} role="status">
      <p className="font-bold">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-md text-sm text-black/60">{body}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
