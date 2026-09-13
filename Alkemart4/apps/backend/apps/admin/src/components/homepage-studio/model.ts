import type { HomeSection } from "@alkemart/shared/homepage"
import {
  GridFour,
  Megaphone,
  ShieldCheck,
  SquaresFour,
  Stack,
  Tag,
} from "@phosphor-icons/react"

export const sectionLabels: Record<HomeSection["type"], string> = {
  promo_hero: "Promo banner",
  promo_grid: "Promo grid",
  category_grid: "Category grid",
  product_shelf: "Product shelf",
  promo_band: "Promo band",
  value_grid: "Value grid",
}

/** One-line guidance per type, shown once in the settings header. */
export const sectionHints: Record<HomeSection["type"], string> = {
  promo_hero: "One strong seasonal message above the fold.",
  promo_grid: "Campaign tiles — Bento features the first tile large.",
  category_grid: "Real catalogue categories in tiles, mosaic, or rail.",
  product_shelf: "Featured, latest, category-scoped, or hand-picked products.",
  promo_band: "Compact CTA strip for seller and service callouts.",
  value_grid: "Trust messages: delivery, payment, sellers.",
}

/**
 * Per-type accent so the studio doesn't read as one monotonous list.
 * Soft tints only — the storefront brand stays gold/black/white.
 */
export const sectionAccents: Record<HomeSection["type"], { icon: typeof Megaphone; chip: string; dot: string }> = {
  promo_hero: { icon: Megaphone, chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  promo_grid: { icon: GridFour, chip: "bg-sky-500/15 text-sky-700 dark:text-sky-400", dot: "bg-sky-500" },
  category_grid: { icon: SquaresFour, chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  product_shelf: { icon: Stack, chip: "bg-violet-500/15 text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  promo_band: { icon: Tag, chip: "bg-rose-500/15 text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  value_grid: { icon: ShieldCheck, chip: "bg-slate-500/15 text-slate-600 dark:text-slate-400", dot: "bg-slate-500" },
}

export function sectionName(section: HomeSection): string {
  return "title" in section && section.title ? section.title : sectionLabels[section.type]
}

/** Storefront origin for the live preview iframe. Same default as local dev. */
export function storefrontBase(): string {
  const raw = (import.meta.env.VITE_ALKEMART_STOREFRONT_URL as string | undefined)?.trim()
  return (raw ? raw : "http://127.0.0.1:5175").replace(/\/$/, "")
}

export function newSection(type: HomeSection["type"]): HomeSection {
  const id = `${type}-${crypto.randomUUID().slice(0, 8)}`
  if (type === "promo_hero") return { id, type, title: "A brighter way to shop", subtitle: "Seasonal picks from sellers across Ghana.", body: "Discover useful finds from sellers across Ghana.", theme: "gold", layout: "split", action: { label: "Shop now", href: "/categories/all" }, visible: true }
  if (type === "promo_grid") return { id, type, title: "Today on Alkemart", subtitle: "Curated campaigns.", columns: 2, theme: "white", variant: "cards", tiles: [{ id: `${id}-1`, title: "Featured collection", body: "Add campaign copy here.", href: "/categories/all" }], visible: true }
  if (type === "category_grid") return { id, type, title: "Shop by category", subtitle: "Browse the departments buyers use most.", columns: 4, variant: "tiles", showAllLink: true, categoryIds: [], visible: true }
  if (type === "product_shelf") return { id, type, title: "Fresh picks", subtitle: "Just landed from our sellers.", source: "featured", limit: 8, layout: "grid", visible: true }
  if (type === "promo_band") return { id, type, title: "Sell on Alkemart", body: "Open a shop and list products for buyers nationwide.", theme: "gold", action: { label: "Start selling", href: "/sell" }, secondaryAction: { label: "How selling works", href: "/sell" }, visible: true }
  return { id, type, title: "Why shop Alkemart", items: [{ id: `${id}-1`, title: "Local sellers", body: "Shop from businesses across Ghana." }, { id: `${id}-2`, title: "Flexible delivery", body: "Choose an option that works for you." }], visible: true }
}
