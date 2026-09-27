import { checkFloor } from "@alkemart/domain"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import type { DealRow } from "../../deals-store"
import { applyDealAction, publicDeal, sweepDeals } from "../../lib/deals"
import { clockOf } from "../../lib/returns"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"

/** Seller side: which listings take offers (and the hidden floor), and answering offers. */
const SettingsBody = z.object({ negotiable: z.boolean(), floorPesewas: z.string().regex(/^\d{1,12}$/).nullable().optional() })
const CounterBody = z.object({ amountPesewas: z.string().regex(/^\d{1,12}$/) })

function sellerOf(c: Context<AppEnv>) {
  const id = c.get("auth").sellerId
  if (!id) throw new HTTPException(403, { message: "forbidden" })
  return id
}

async function mine(c: Context<AppEnv>): Promise<DealRow> {
  const d = await c.get("deals").getDeal(c.req.param("id") ?? "")
  if (!d || d.sellerId !== sellerOf(c)) throw new HTTPException(404, { message: "offer not found" })
  return d
}

export const vendorDeals = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/", async (c) => {
    const sellerId = sellerOf(c)
    const store = c.get("deals")
    await sweepDeals(store, clockOf(c.get("checkoutRepo")))
    const rows = await store.listDeals({ sellerId })
    const cards = await c.get("repo").productCardsByIds([...new Set(rows.map((d) => d.productId))]).catch(() => new Map())
    const rank = (d: DealRow) => (d.status === "pending" ? 0 : d.status === "countered" ? 1 : 2)
    return c.json({
      items: rows.sort((a, b) => rank(a) - rank(b)).map((d) => publicDeal(d, { productTitle: cards.get(d.productId)?.title ?? null })),
      waitingOnYou: rows.filter((d) => d.status === "pending").length,
    })
  })
  /** `?offerIds=a,b` → negotiation settings for your own listings (floor included — it's yours). */
  .get("/settings", async (c) => {
    const sellerId = sellerOf(c)
    const ids = (c.req.query("offerIds") ?? "").split(",").filter(Boolean).slice(0, 100)
    const rows = await c.get("deals").getNegotiation(ids)
    return c.json({
      settings: Object.fromEntries(
        ids.map((id) => {
          const r = rows.get(id)
          return [id, r && r.sellerId === sellerId ? { negotiable: r.negotiable, floorPesewas: r.floorPesewas?.toString() ?? null } : { negotiable: false, floorPesewas: null }]
        }),
      ),
    })
  })
  .put("/settings/:offerId", async (c) => {
    const sellerId = sellerOf(c)
    const parsed = SettingsBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Enter a lowest price like 1500 or 1500.50, or leave it empty." })
    const view = await c.get("checkoutRepo").getOfferView(c.req.param("offerId"))
    if (!view || view.offer.sellerId !== sellerId) throw new HTTPException(404, { message: "listing not found" })
    const floor = parsed.data.floorPesewas ? BigInt(parsed.data.floorPesewas) : null
    const problem = checkFloor(floor, view.offer.pricePesewas)
    if (problem) throw new HTTPException(400, { message: problem })
    const saved = await c.get("deals").setNegotiation({ offerId: view.offer.id, sellerId, negotiable: parsed.data.negotiable, floorPesewas: floor })
    return c.json({ settings: { negotiable: saved.negotiable, floorPesewas: saved.floorPesewas?.toString() ?? null } })
  })
  .post("/:id/accept", async (c) => c.json({ deal: publicDeal(await applyDealAction(c, await mine(c), { by: "seller", type: "accept" })) }))
  .post("/:id/decline", async (c) => c.json({ deal: publicDeal(await applyDealAction(c, await mine(c), { by: "seller", type: "decline" })) }))
  .post("/:id/counter", async (c) => {
    const parsed = CounterBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Enter a price like 1500 or 1500.50." })
    return c.json({ deal: publicDeal(await applyDealAction(c, await mine(c), { by: "seller", type: "counter", amountMinor: BigInt(parsed.data.amountPesewas) })) })
  })
