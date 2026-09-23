import { getAlkemartApiUrl } from "./env"
import { mapCfProductCard, type StoreProductCard } from "./products"
import type { ProductCard as CfProductCard } from "./api-client"

export type CourseCreative = {
  title: string
  subtitle: string | null
  imageUrl: string | null
  link: string | null
} | null

export type CourseCampaign = {
  id: string
  name: string
  trackingId: string
  objective: string
  sponsored: boolean
  terms: { label: string; summary: string } | null
  creative: { desktop: CourseCreative; mobile: CourseCreative }
  products: StoreProductCard[]
}

export type CoursePlacement = {
  code: string
  job: string
  campaigns: CourseCampaign[]
}

export type CourseShelf = {
  key: string
  title: string
  cards: StoreProductCard[]
}

export type Course = {
  placements: CoursePlacement[]
  shelves: CourseShelf[]
}

/** Placement slots the course can fill (ADR-004 inventory). */
export const COURSE_PLACEMENTS = ["hero", "deal_rail", "promo_grid", "promo_band", "marquee"] as const

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null

function mapCreative(v: unknown): CourseCreative {
  if (!v || typeof v !== "object") return null
  const r = v as Record<string, unknown>
  const title = str(r.title)
  if (!title) return null
  return {
    title,
    subtitle: str(r.subtitle),
    imageUrl: str(r.imageUrl),
    link: str(r.link),
  }
}

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

/**
 * Map the course payload defensively — unknown slots, campaigns without
 * cards, and malformed rows drop out instead of rendering broken promises.
 * Pure (no I/O) so it is unit-testable.
 */
export function mapCourseResponse(data: unknown): Course | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const placements: CoursePlacement[] = []
  if (Array.isArray(d.placements)) {
    for (const item of d.placements) {
      if (!item || typeof item !== "object") continue
      const p = item as Record<string, unknown>
      const code = str(p.code)
      if (!code) continue
      const campaigns: CourseCampaign[] = []
      if (Array.isArray(p.campaigns)) {
        for (const cu of p.campaigns) {
          if (!cu || typeof cu !== "object") continue
          const c = cu as Record<string, unknown>
          const id = str(c.id)
          const name = str(c.name)
          if (!id || !name) continue
          const products: StoreProductCard[] = []
          if (Array.isArray(c.products)) {
            for (const card of c.products) {
              const mapped = mapCard(card)
              if (mapped) products.push(mapped)
            }
          }
          if (products.length === 0) continue
          const creative = (c.creative ?? {}) as Record<string, unknown>
          const terms = (c.terms ?? null) as Record<string, unknown> | null
          campaigns.push({
            id,
            name,
            trackingId: str(c.trackingId) ?? id,
            objective: str(c.objective) ?? "sale",
            sponsored: c.sponsored === true,
            terms:
              terms && str(terms.label)
                ? { label: str(terms.label) as string, summary: str(terms.summary) ?? "" }
                : null,
            creative: {
              desktop: mapCreative(creative.desktop),
              mobile: mapCreative(creative.mobile),
            },
            products,
          })
        }
      }
      if (campaigns.length === 0) continue
      placements.push({
        code,
        job: str(p.job) ?? code,
        campaigns,
      })
    }
  }
  const shelves: CourseShelf[] = []
  if (Array.isArray(d.shelves)) {
    for (const item of d.shelves) {
      if (!item || typeof item !== "object") continue
      const s = item as Record<string, unknown>
      const key = str(s.key)
      if (!key) continue
      const cards: StoreProductCard[] = []
      if (Array.isArray(s.cards)) {
        for (const card of s.cards) {
          const mapped = mapCard(card)
          if (mapped) cards.push(mapped)
        }
      }
      if (cards.length === 0) continue
      shelves.push({ key, title: str(s.title) ?? key, cards })
    }
  }
  return { placements, shelves }
}

export type CourseBucket = "control" | "exposed"

/**
 * Phase 7D wiring: the `homepage-shelf-order` experiment moves the trending
 * shelf first for exposed units. Control renders server order. Pure and
 * unit-testable; assignment comes from the registry.
 */
export function orderShelvesForBucket(
  shelves: CourseShelf[],
  bucket: CourseBucket,
): CourseShelf[] {
  if (bucket !== "exposed") return shelves
  const i = shelves.findIndex((s) => s.key === "trending")
  if (i <= 0) return shelves
  const next = [...shelves]
  const [trending] = next.splice(i, 1)
  next.unshift(trending as CourseShelf)
  return next
}

const EXP_UNIT_KEY = "alkemart_exp_unit"

function getUnitId(): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    let unit = window.localStorage.getItem(EXP_UNIT_KEY)
    if (!unit) {
      unit = crypto.randomUUID()
      window.localStorage.setItem(EXP_UNIT_KEY, unit)
    }
    return unit
  } catch {
    return null
  }
}

/**
 * Bucket for a registry experiment. Unknown experiments, failures, and
 * missing units all answer control — the feature simply stays off.
 */
export async function assignBucket(experimentKey: string): Promise<CourseBucket> {
  try {
    const base = getAlkemartApiUrl()
    const unit = getUnitId()
    if (!base || !unit) return "control"
    const res = await fetch(
      `${base}/store/experiments/assign?experiment=${encodeURIComponent(experimentKey)}&unit=${encodeURIComponent(unit)}`,
      { headers: { Accept: "application/json" } },
    )
    if (!res.ok) return "control"
    const data = (await res.json()) as { bucket?: unknown }
    return data.bucket === "exposed" ? "exposed" : "control"
  } catch {
    return "control"
  }
}

export async function fetchCourse(): Promise<Course> {  const base = getAlkemartApiUrl()
  if (!base) throw new Error("VITE_ALKEMART_API_URL is not set")
  const res = await fetch(`${base}/store/course`, { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`course ${res.status}`)
  const mapped = mapCourseResponse(await res.json())
  if (!mapped) throw new Error("course unmapped")
  return mapped
}

/**
 * Promotion beacon (Phase 5D): view/select with placement + campaign +
 * creative + position. No PII, fire-and-forget, never throws — measurement
 * must not break commerce UX.
 */
export function fireCourseEvent(input: {
  campaignId: string
  placementCode: string
  creativeId?: string | null
  position?: number | null
  event: "view" | "select"
}): void {
  try {
    const base = getAlkemartApiUrl()
    if (!base || !input.campaignId || !input.placementCode) return
    void fetch(`${base}/store/course/events`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: input.campaignId,
        placementCode: input.placementCode,
        creativeId: input.creativeId ?? null,
        position: input.position ?? null,
        event: input.event,
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* never break commerce UX */
  }
}
