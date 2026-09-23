import { getAlkemartApiUrl } from "./env"
import { mapCfProductCard, type StoreProductCard } from "./products"
import type { ProductCard as CfProductCard } from "./api-client"

export type GuidePick = {
  label: string | null
  cards: StoreProductCard[]
}

export type GuideSection = {
  heading: string
  body: string
  picks: GuidePick[]
}

export type Guide = {
  slug: string
  title: string
  excerpt: string
  author: string
  publishedAt: string | null
  refreshAfter: string | null
  revision: number
}

export type GuideDetail = {
  guide: Guide
  sections: GuideSection[]
  related: { slug: string; title: string; excerpt: string }[]
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null

function mapCard(v: unknown): StoreProductCard | null {
  if (!v || typeof v !== "object") return null
  try {
    const card = mapCfProductCard(v as unknown as CfProductCard)
    if (!card.id || !card.title) return null
    return card
  } catch {
    return null
  }
}

function mapGuide(v: unknown): Guide | null {
  if (!v || typeof v !== "object") return null
  const g = v as Record<string, unknown>
  const slug = str(g.slug)
  const title = str(g.title)
  if (!slug || !title) return null
  return {
    slug,
    title,
    excerpt: str(g.excerpt) ?? "",
    author: str(g.author) ?? "Alkemart editorial",
    publishedAt: str(g.publishedAt),
    refreshAfter: str(g.refreshAfter),
    revision: typeof g.revision === "number" ? g.revision : 1,
  }
}

/** Published guides (hub-and-spoke index). Empty when none — never stubs. */
export async function listGuides(): Promise<Guide[]> {
  const base = getAlkemartApiUrl()
  if (!base) return []
  try {
    const res = await fetch(`${base}/store/guides`, { headers: { Accept: "application/json" } })
    if (!res.ok) return []
    const data = (await res.json()) as { items?: unknown }
    if (!Array.isArray(data.items)) return []
    const out: Guide[] = []
    for (const item of data.items) {
      const mapped = mapGuide(item)
      if (mapped) out.push(mapped)
    }
    return out
  } catch {
    return []
  }
}

/**
 * One guide with live picks. Prices, stock, and sellers resolve from the
 * catalog at serve time — prose never embeds them, so advice cannot go
 * stale. Null when the guide is missing or unpublished.
 */
export async function getGuide(slug: string): Promise<GuideDetail | null> {
  const key = slug.trim()
  if (!key) return null
  const base = getAlkemartApiUrl()
  if (!base) return null
  try {
    const res = await fetch(`${base}/store/guides/${encodeURIComponent(key)}`, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      guide?: unknown
      sections?: unknown
      related?: unknown
    }
    const guide = mapGuide(data.guide)
    if (!guide) return null
    const sections: GuideSection[] = []
    if (Array.isArray(data.sections)) {
      for (const item of data.sections) {
        if (!item || typeof item !== "object") continue
        const s = item as Record<string, unknown>
        const heading = str(s.heading)
        const body = str(s.body)
        if (!heading || !body) continue
        const picks: GuidePick[] = []
        if (Array.isArray(s.picks)) {
          for (const pk of s.picks) {
            if (!pk || typeof pk !== "object") continue
            const p = pk as Record<string, unknown>
            const cards: StoreProductCard[] = []
            if (Array.isArray(p.cards)) {
              for (const card of p.cards) {
                const mapped = mapCard(card)
                if (mapped) cards.push(mapped)
              }
            }
            picks.push({ label: str(p.label), cards })
          }
        }
        sections.push({ heading, body, picks })
      }
    }
    const related: GuideDetail["related"] = []
    if (Array.isArray(data.related)) {
      for (const item of data.related) {
        if (!item || typeof item !== "object") continue
        const r = item as Record<string, unknown>
        const rslug = str(r.slug)
        const rtitle = str(r.title)
        if (!rslug || !rtitle) continue
        related.push({ slug: rslug, title: rtitle, excerpt: str(r.excerpt) ?? "" })
      }
    }
    return { guide, sections, related }
  } catch {
    return null
  }
}
