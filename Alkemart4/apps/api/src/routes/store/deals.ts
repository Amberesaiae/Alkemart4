import { DealRuleError, OPEN_DEAL_STATUSES, judgeBuyerOffer } from "@alkemart/domain"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import type { DealRow } from "../../deals-store"
import { applyDealAction, dealPolicy, notifyDeal, publicDeal, sweepDeals } from "../../lib/deals"
import { clockOf } from "../../lib/returns"
import { readJsonBody } from "../../lib/session"
import { requireFreshSession } from "../../middleware/auth"

/**
 * Buyer side of "Make an offer". Which listings are negotiable is public;
 * making and answering offers needs a signed-in buyer (the accepted price
 * is tied to the account at checkout). The floor never leaves the server.
 */
const OfferBody = z.object({ offerId: z.string().min(1), qty: z.number().int().min(1).max(99).default(1), amountPesewas: z.string().regex(/^\d{1,12}$/) })

async function mine(c: Context<AppEnv>): Promise<DealRow> {
  const d = await c.get("deals").getDeal(c.req.param("id") ?? "")
  if (!d || d.buyerUserId !== c.get("auth").userId) throw new HTTPException(404, { message: "offer not found" })
  return d
}

export const storeDeals = new Hono<AppEnv>()
  /** `?offerIds=a,b` → which of these listings take offers. */
  .get("/negotiable", async (c) => {
    const ids = (c.req.query("offerIds") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50)
    const rows = await c.get("deals").getNegotiation(ids)
    c.header("Cache-Control", "public, max-age=60")
    return c.json({ negotiable: Object.fromEntries(ids.map((id) => [id, rows.get(id)?.negotiable ?? false])) })
  })
  .use("/*", requireFreshSession)
  .get("/", async (c) => {
    const store = c.get("deals")
    await sweepDeals(store, clockOf(c.get("checkoutRepo")))
    const rows = await store.listDeals({ buyerUserId: c.get("auth").userId })
    const offerId = c.req.query("offerId")
    const sellers = new Map((await c.get("authRepo").listSellers().catch(() => [])).map((s) => [s.id, s.name]))
    return c.json({ items: rows.filter((d) => !offerId || d.offerId === offerId).map((d) => publicDeal(d, { sellerName: sellers.get(d.sellerId) ?? null })) })
  })
  .post("/", async (c) => {
    const parsed = OfferBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Enter a price like 1500 or 1500.50." })
    const checkout = c.get("checkoutRepo")
    const view = await checkout.getOfferView(parsed.data.offerId)
    if (!view || !view.offer.active || view.productStatus !== "published" || view.sellerStatus !== "open") throw new HTTPException(404, { message: "This listing isn't available." })
    const store = c.get("deals")
    const now = clockOf(checkout)
    await sweepDeals(store, now)
    const neg = (await store.getNegotiation([view.offer.id])).get(view.offer.id)
    const policy = await dealPolicy(c)
    const userId = c.get("auth").userId
    const open = (await store.listDeals({ buyerUserId: userId, statuses: [...OPEN_DEAL_STATUSES] })).length
    if ((await store.listDeals({ buyerUserId: userId, offerId: view.offer.id, statuses: [...OPEN_DEAL_STATUSES, "accepted"] })).length) {
      throw new HTTPException(409, { message: "You already have an offer on this item. Wait for the answer, or withdraw it." })
    }
    const amount = BigInt(parsed.data.amountPesewas)
    let verdict
    try {
      verdict = judgeBuyerOffer(
        {
          priceMinor: view.offer.pricePesewas,
          amountMinor: amount,
          qty: parsed.data.qty,
          available: view.offer.onHand - view.offer.reserved,
          negotiable: !!neg?.negotiable,
          floorMinor: neg?.floorPesewas ?? null,
          openByBuyer: open,
        },
        policy,
      ).verdict
    } catch (e) {
      if (e instanceof DealRuleError) throw new HTTPException(409, { message: e.message })
      throw e
    }
    const user = await c.get("authRepo").findUserById(userId)
    const auto = verdict === "auto_decline"
    const d = await store.createDeal({
      offerId: view.offer.id,
      productId: view.offer.productId,
      sellerId: view.offer.sellerId,
      buyerUserId: userId,
      buyerName: user?.firstName ?? null,
      qty: parsed.data.qty,
      listPricePesewas: view.offer.pricePesewas,
      amountPesewas: amount,
      status: auto ? "declined" : "pending",
      respondBy: auto ? null : new Date(now.getTime() + policy.sellerReplyHours * 3_600_000),
      entry: { by: auto ? "system" : "buyer", note: auto ? "Below what the seller accepts — declined automatically" : "Buyer made an offer" },
    })
    if (!auto) await notifyDeal(c, d, "buyer").catch(() => undefined)
    return c.json({ deal: publicDeal(d, { sellerName: view.sellerName, productTitle: view.productTitle }), autoDeclined: auto }, 201)
  })
  .post("/:id/:action{accept|decline|withdraw}", async (c) => {
    const d = await mine(c)
    const action = c.req.param("action") as "accept" | "decline" | "withdraw"
    const next = await applyDealAction(c, d, { by: "buyer", type: action })
    return c.json({ deal: publicDeal(next) })
  })
