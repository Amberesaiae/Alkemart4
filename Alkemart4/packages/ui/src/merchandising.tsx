import type { ReactNode } from "react"
import { ArrowRight } from "@phosphor-icons/react"
import { cn } from "./cn"

export type MerchTheme = "white" | "gold" | "black"

function themeClass(theme: MerchTheme) {
  if (theme === "gold") return "bg-primary text-black"
  if (theme === "black") return "bg-black text-white"
  return "border border-black/10 bg-white text-black"
}

export function MerchPromoHero({ eyebrow, title, body, imageUrl, action, theme, interactive = true, compact = false, className }: {
  eyebrow?: string
  title: string
  body?: string
  imageUrl?: string
  action?: { label: string; href: string }
  theme: MerchTheme
  interactive?: boolean
  compact?: boolean
  className?: string
}) {
  const actionNode = action ? (
    <span className={cn("mt-6 inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 text-sm font-bold", theme === "black" ? "bg-primary text-black" : "bg-black text-white")}>
      {action.label}<ArrowRight className="h-4 w-4" />
    </span>
  ) : null
  return (
    <section className={cn("grid overflow-hidden rounded-3xl sm:grid-cols-2", compact ? "min-h-52" : "min-h-[300px]", themeClass(theme), className)}>
      <div className={cn("flex flex-col justify-center", compact ? "p-6" : "p-7 sm:p-10 lg:p-14")}>
        {eyebrow ? <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] opacity-65">{eyebrow}</p> : null}
        <h2 className={cn("font-black leading-[1.02] tracking-tight", compact ? "text-2xl" : "text-3xl sm:text-4xl lg:text-5xl")}>{title}</h2>
        {body ? <p className="mt-4 max-w-lg text-sm leading-6 opacity-75 sm:text-base">{body}</p> : null}
        {actionNode && interactive ? <a href={action!.href}>{actionNode}</a> : actionNode}
      </div>
      <div className={cn("bg-white/35 bg-cover bg-center", compact ? "min-h-36" : "min-h-[240px]")} style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined} aria-hidden="true" />
    </section>
  )
}

export function MerchPromoGrid({ title, columns, theme, tiles, interactive = true, compact = false, className }: {
  title?: string
  columns: 2 | 3 | 4
  theme: MerchTheme
  tiles: Array<{ id: string; title: string; body?: string; imageUrl?: string; href: string }>
  interactive?: boolean
  compact?: boolean
  className?: string
}) {
  return <section className={cn("space-y-4", className)}>{title ? <h2 className="text-2xl font-black tracking-tight">{title}</h2> : null}<div className={cn("grid gap-3", columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4")}>{tiles.map((tile) => {
    const card = <div className={cn("group relative overflow-hidden rounded-2xl p-5", compact ? "min-h-28" : "min-h-52", themeClass(theme))}><div className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-[1.03]" style={tile.imageUrl ? { backgroundImage: `url(${tile.imageUrl})` } : undefined} /><div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" /><div className="relative z-10 flex h-full flex-col justify-end text-white"><p className="text-xl font-black">{tile.title}</p>{tile.body ? <p className="mt-1 text-sm text-white/80">{tile.body}</p> : null}</div></div>
    return interactive ? <a key={tile.id} href={tile.href}>{card}</a> : <div key={tile.id}>{card}</div>
  })}</div></section>
}

export function MerchGridSection({ title, action, columns, children, className }: { title: string; action?: ReactNode; columns: 4 | 6 | 8; children: ReactNode; className?: string }) {
  return <section className={cn("space-y-4", className)}><div className="flex items-end justify-between gap-3"><h2 className="text-2xl font-black tracking-tight">{title}</h2>{action}</div><div className={cn("grid gap-3", columns === 4 ? "grid-cols-2 sm:grid-cols-4" : columns === 6 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-4 sm:grid-cols-8")}>{children}</div></section>
}

export function MerchShelf({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return <section className={cn("space-y-4", className)}><h2 className="text-2xl font-black tracking-tight">{title}</h2>{children}</section>
}

export function MerchValueGrid({ title, items, compact = false, className }: { title?: string; items: Array<{ id: string; title: string; body: string }>; compact?: boolean; className?: string }) {
  return <section className={cn("rounded-3xl bg-black text-white", compact ? "p-5" : "p-6 sm:p-8", className)}>{title ? <h2 className="mb-5 text-2xl font-black">{title}</h2> : null}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => <article key={item.id} className="rounded-2xl border border-white/15 p-5"><span className="mb-4 block h-3 w-3 rounded-full bg-primary" /><h3 className="font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-white/65">{item.body}</p></article>)}</div></section>
}
