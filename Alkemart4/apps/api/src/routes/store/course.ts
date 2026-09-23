import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { ProductCardDto } from "@alkemart/domain"
import { dedupePlacementWinners, resolvePlacement, type CampaignCandidate } from "@alkemart/domain"
import type { LiveCampaignDto } from "../../campaigns"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"

const SHELF_LIMIT = 8
const MIN_RATINGS = 3
const MIN_RATING_AVG = 4

async function orderedCards(
  c: { get(k: "repo"): AppEnv["Variables"]["repo"] },
  productIds: string[],
): Promise<ProductCardDto[]> {
  if (productIds.length === 0) return []
  const byId = await c
    .get("repo")
    .productCardsByIds(productIds)
    .catch(() => new Map<string, ProductCardDto>())
  // Set order is the merchandising decision; vanished products drop out.
  return productIds.flatMap((id) => {
    const card = byId.get(id)
    return card ? [card] : []
  })
}

function toCandidate(c: LiveCampaignDto): CampaignCandidate {
  return {
    id: c.id,
    placementCode: c.placementCode,
    status: c.status,
    priority: c.priority,
    startsAt: c.startsAt ? new Date(c.startsAt) : null,
    endsAt: c.endsAt ? new Date(c.endsAt) : null,
    createdAt: new Date(c.createdAt),
  }
}

/**
 * Phase 5A/5C/5D — resolved homepage course. Placements carry their winning
 * live campaign (eligibility-filtered, min-products gated, de-duplicated
 * across slots); rule shelves resolve from delivered-order and verified-
 * review truth. Empty slots and shelves collapse — never placeholder.
 */
export const storeCourse = new Hono<AppEnv>()
  .get("/", async (c) => {
    const now = new Date()
    const store = c.get("campaigns")
    await store.sweepExpired(now).catch(() => [])
    const [placements, live] = await Promise.all([
      store.listPlacements(),
      store.listLiveCampaigns(now),
    ])
    const liveById = new Map(live.map((l) => [l.id, l]))
    const byPlacement = new Map<string, LiveCampaignDto[]>()
    for (const item of live) {
      const list = byPlacement.get(item.placementCode) ?? []
      list.push(item)
      byPlacement.set(item.placementCode, list)
    }

    const wins = placements.map((p) => {
      const cands = (byPlacement.get(p.code) ?? []).map(toCandidate)
      const { winner, suppressed } = resolvePlacement(p.code, cands, now)
      return { placementCode: p.code, winner, suppressed }
    })
    const deduped = dedupePlacementWinners(wins)
    const placementByCode = new Map(placements.map((p) => [p.code, p]))

    // Eligibility + cards for winners (and promo-grid runners-up).
    const wanted = new Map<string, LiveCampaignDto>()
    for (const w of deduped) {
      const placement = placementByCode.get(w.placementCode)
      if (!placement || !w.winner) continue
      const full = liveById.get(w.winner.id)
      if (full) wanted.set(full.id, full)
      if (placement.maxLive > 1) {
        const runnerId = w.suppressed[0]?.id
        const runner = runnerId ? liveById.get(runnerId) : undefined
        if (runner) wanted.set(runner.id, runner)
      }
    }
    const eligibility = await c
      .get("repo")
      .checkCampaignEligibility([...wanted.values()].flatMap((l) => l.productIds))
      .catch(() => new Map<string, { eligible: boolean; reasons: string[] }>())

    const placementsOut: {
      code: string
      job: string
      campaigns: {
        id: string
        name: string
        trackingId: string
        objective: string
        sponsored: boolean
        terms: { label: string; summary: string } | null
        creative: {
          desktop: { title: string; subtitle: string | null; imageUrl: string | null; link: string | null } | null
          mobile: { title: string; subtitle: string | null; imageUrl: string | null; link: string | null } | null
        }
        products: ProductCardDto[]
      }[]
    }[] = []
    for (const w of deduped) {
      const placement = placementByCode.get(w.placementCode)
      if (!placement) continue
      const entries: LiveCampaignDto[] = []
      if (w.winner) {
        const full = liveById.get(w.winner.id)
        if (full) entries.push(full)
      }
      if (placement.maxLive > 1 && entries.length > 0) {
        const runnerId = w.suppressed[0]?.id
        const runner = runnerId ? liveById.get(runnerId) : undefined
        if (runner && !entries.some((e) => e.id === runner.id)) entries.push(runner)
      }
      const resolved: (typeof placementsOut)[number]["campaigns"] = []
      for (const entry of entries) {
        let eligibleIds = entry.productIds.filter((pid) => eligibility.get(pid)?.eligible)
        if (entry.sellerIds.length > 0) {
          const cards = await orderedCards(c, eligibleIds)
          const allowed = new Set(entry.sellerIds)
          const kept = cards.filter((card) => allowed.has(card.sellerId)).map((card) => card.productId)
          eligibleIds = eligibleIds.filter((pid) => kept.includes(pid))
        }
        if (eligibleIds.length < placement.constraints.minProducts) continue
        const cards = await orderedCards(c, eligibleIds)
        if (cards.length === 0) continue
        const pick = (slotName: string) =>
          entry.creatives.find((r) => r.slot === slotName) ?? entry.creatives[0] ?? null
        const desktop = pick("desktop")
        const mobile = pick("mobile")
        resolved.push({
          id: entry.id,
          name: entry.name,
          trackingId: entry.trackingId,
          objective: entry.objective,
          sponsored: entry.sponsored,
          terms: entry.terms ? { label: entry.terms.label, summary: entry.terms.summary } : null,
          creative: {
            desktop: desktop
              ? { title: desktop.title, subtitle: desktop.subtitle, imageUrl: desktop.imageUrl, link: desktop.link }
              : null,
            mobile: mobile
              ? { title: mobile.title, subtitle: mobile.subtitle, imageUrl: mobile.imageUrl, link: mobile.link }
              : null,
          },
          products: cards,
        })
        if (resolved.length >= Math.max(1, placement.maxLive)) break
      }
      placementsOut.push({ code: placement.code, job: placement.job, campaigns: resolved })
    }

    // Rule shelves resolve from delivered orders and verified reviews.
    const checkout = c.get("checkoutRepo")
    const [allTime, weekly, drops, newest] = await Promise.all([
      checkout.productUnitsSince(new Date(0)).catch(() => new Map<string, number>()),
      checkout.productUnitsSince(new Date(now.getTime() - 7 * 24 * 3_600_000)).catch(() => new Map<string, number>()),
      c.get("repo").listRecentPriceDrops(new Date(now.getTime() - 30 * 24 * 3_600_000), 20).catch(() => []),
      c.get("repo").listCatalog({ limit: SHELF_LIMIT, offset: 0, sort: "newest" }).catch(() => ({ items: [], total: 0 })),
    ])
    const reviewTotals = await checkout
      .reviewTotalsByProduct()
      .catch(() => new Map<string, { count: number; avg: number }>())
    const top = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, SHELF_LIMIT).map(([id]) => id)
    const rated = [...reviewTotals.entries()]
      .filter(([, t]) => t.count >= MIN_RATINGS && t.avg >= MIN_RATING_AVG)
      .sort((a, b) => b[1].avg - a[1].avg || b[1].count - a[1].count)
      .slice(0, SHELF_LIMIT)
      .map(([id]) => id)
    const dropIds = [...new Set(drops.map((d) => d.productId))].slice(0, SHELF_LIMIT)
    const shelfDefs: { key: string; title: string; productIds: string[] }[] = [
      { key: "most_ordered", title: "Most ordered", productIds: top(allTime) },
      { key: "trending", title: "Trending now", productIds: top(weekly) },
      { key: "top_rated", title: "Top rated", productIds: rated },
      { key: "new", title: "New arrivals", productIds: newest.items.map((i) => i.productId) },
      { key: "price_drop", title: "Price drops", productIds: dropIds },
    ]
    const shelves: { key: string; title: string; cards: ProductCardDto[] }[] = []
    for (const shelf of shelfDefs) {
      if (shelf.productIds.length === 0) continue
      const cards = await orderedCards(c, shelf.productIds)
      if (cards.length === 0) continue
      shelves.push({ key: shelf.key, title: shelf.title, cards })
    }

    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
    return c.json({ placements: placementsOut, shelves, generatedAt: now.toISOString() })
  })
  .post("/events", async (c) => {
    const parsed = z
      .object({
        campaignId: z.string().min(1).max(128),
        placementCode: z.string().min(1).max(64),
        creativeId: z.string().min(1).max(128).optional().nullable(),
        position: z.number().int().min(0).max(1000).optional().nullable(),
        event: z.enum(["view", "select"]),
      })
      .safeParse(await readJsonBody(c).catch(() => null))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    await c.get("campaigns").recordEvent(parsed.data.campaignId, {
      placementCode: parsed.data.placementCode,
      creativeId: parsed.data.creativeId ?? null,
      position: parsed.data.position ?? null,
      event: parsed.data.event,
    })
    return c.json({ ok: true }, 202)
  })
