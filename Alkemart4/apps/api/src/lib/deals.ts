/**
 * Make an offer — glue between the domain rules, the deals store, checkout
 * and email. Every step goes through `applyDealAction`.
 */
import {
  DealRuleError,
  dealPolicyFrom,
  dealPriceFor,
  nextDealStep,
  type DealAction,
  type DealPolicy,
} from "@alkemart/domain"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../context"
import type { CartItemRow, CheckoutRepository, IntentDeals } from "../checkout-repository"
import type { DealRow, DealsStore } from "../deals-store"
import { encodeEmail } from "../email"
import { returnUpdateEmail } from "./email-templates"
import { verifySessionJwt } from "./jwt"
import { formatMinorForEmail } from "./money-format"
import { orderEmailLinks } from "./order-emails"
import { clockOf } from "./returns"
import { marketCurrency } from "@alkemart/shared/markets"

export const DEAL_POLICY_KEY = "deal_policy"

/** Make an offer is parked (owner, 2026-09-27): no deal prices reach carts or checkout. */
export const DEALS_ENABLED = false

export async function dealPolicy(c: Context<AppEnv>): Promise<DealPolicy> {
  try {
    return dealPolicyFrom(await c.get("settings").get(DEAL_POLICY_KEY))
  } catch {
    return dealPolicyFrom(null)
  }
}

/** A deal as buyer or seller sees it. The seller's floor never appears here. */
export function publicDeal(d: DealRow, extras: { productTitle?: string | null; sellerName?: string | null } = {}) {
  return {
    id: d.id,
    offerId: d.offerId,
    productId: d.productId,
    productTitle: extras.productTitle ?? null,
    sellerId: d.sellerId,
    sellerName: extras.sellerName ?? null,
    buyerName: d.buyerName ?? "Buyer",
    qty: d.qty,
    listPricePesewas: d.listPricePesewas.toString(),
    amountPesewas: d.amountPesewas.toString(),
    counterPesewas: d.counterPesewas?.toString() ?? null,
    agreedPesewas: d.agreedPesewas?.toString() ?? null,
    status: d.status,
    respondBy: d.respondBy?.toISOString() ?? null,
    validUntil: d.validUntil?.toISOString() ?? null,
    timeline: d.timeline,
    createdAt: d.createdAt.toISOString(),
  }
}

/** Lapse offers nobody answered in time. Never throws. */
export async function sweepDeals(store: DealsStore, now: Date) {
  const due = await store.listDeals({ statuses: ["pending", "countered"], dueAt: now }).catch((): DealRow[] => [])
  for (const d of due) {
    const step = (() => {
      try {
        return nextDealStep(stateOf(d), { by: "system", type: "expire" }, now)
      } catch {
        return null
      }
    })()
    if (step) await store.advanceDeal(d.id, d.status, { status: step.status, respondBy: null, entry: { by: "system", note: step.note } }).catch(() => null)
  }
}

const stateOf = (d: DealRow) => ({ status: d.status, amountMinor: d.amountPesewas, counterMinor: d.counterPesewas, priceMinor: d.listPricePesewas, respondBy: d.respondBy })

export async function applyDealAction(c: Context<AppEnv>, d: DealRow, action: DealAction): Promise<DealRow> {
  const now = clockOf(c.get("checkoutRepo"))
  let step
  try {
    step = nextDealStep(stateOf(d), action, now, await dealPolicy(c))
  } catch (e) {
    if (e instanceof DealRuleError) throw new HTTPException(409, { message: e.message })
    throw e
  }
  const next = await c.get("deals").advanceDeal(d.id, d.status, {
    status: step.status,
    respondBy: step.respondBy,
    ...(step.counterMinor !== undefined ? { counterPesewas: step.counterMinor } : {}),
    ...(step.agreedMinor !== undefined ? { agreedPesewas: step.agreedMinor } : {}),
    ...(step.validUntil !== undefined ? { validUntil: step.validUntil } : {}),
    entry: { by: action.by, note: step.note },
  })
  if (!next) throw new HTTPException(409, { message: "This offer has already moved on. Refresh to see where it stands." })
  await notifyDeal(c, next, action.by).catch(() => undefined)
  return next
}

/** Signed-in buyer on an optional-auth route (checkout), or null. */
export async function optionalUserId(c: Context<AppEnv>): Promise<string | null> {
  const h = c.req.header("Authorization") ?? ""
  const [scheme, token] = h.split(" ")
  const secret = c.get("jwtSecret")
  if (!token || scheme?.toLowerCase() !== "bearer" || !secret) return null
  try {
    return (await verifySessionJwt(token, secret)).userId
  } catch {
    return null
  }
}

/**
 * Accepted deals that fit this cart exactly (same buyer, listing and
 * quantity, still valid) — frozen on the intent at checkout.
 */
export async function dealsForCart(c: Context<AppEnv>, items: CartItemRow[]): Promise<{ deals: IntentDeals | null; used: DealRow[] }> {
  if (!DEALS_ENABLED) return { deals: null, used: [] }
  const buyerUserId = await optionalUserId(c)
  if (!buyerUserId) return { deals: null, used: [] }
  const now = clockOf(c.get("checkoutRepo"))
  const accepted = await c.get("deals").listDeals({ buyerUserId, statuses: ["accepted"] }).catch((): DealRow[] => [])
  const deals: IntentDeals = {}
  const used: DealRow[] = []
  for (const item of items) {
    const hit = accepted.find((d) => dealPriceFor({ ...d, agreedMinor: d.agreedPesewas }, { buyerUserId, offerId: item.offerId, qty: item.qty }, now) !== null)
    if (hit && hit.agreedPesewas !== null) {
      deals[item.offerId] = { dealId: hit.id, unitPricePesewas: hit.agreedPesewas.toString(), qty: hit.qty }
      used.push(hit)
    }
  }
  return { deals: used.length ? deals : null, used }
}

/** An accepted price is spent by the checkout that uses it (a failed payment means asking again). */
export async function markDealsUsed(store: DealsStore, used: DealRow[], intentId: string) {
  for (const d of used) {
    await store.advanceDeal(d.id, "accepted", { status: "used", respondBy: null, usedIntentId: intentId, entry: { by: "buyer", note: "Used at checkout" } }).catch(() => null)
  }
}

/** Accepted deal price per cart line, for showing on the cart (never trusted from the client). */
export async function cartDealPrices(c: Context<AppEnv>, checkout: CheckoutRepository, cartId: string) {
  const items = await checkout.listCartItems(cartId).catch((): CartItemRow[] => [])
  return (await dealsForCart(c, items)).deals
}

export async function notifyDeal(c: Context<AppEnv>, d: DealRow, by: string) {
  const links = orderEmailLinks(c)
  const money = (m: bigint | null) => (m === null ? "" : formatMinorForEmail(m, marketCurrency()))
  const toSeller = by === "buyer"
  const to = toSeller ? await links.sellerEmail?.(d.sellerId).catch(() => null) : (await c.get("authRepo").findUserById(d.buyerUserId).catch(() => null))?.email
  const base = toSeller ? links.vendorUrl : links.storefrontUrl
  if (!to || !base) return
  const heading =
    d.status === "pending" && toSeller
      ? `New offer: ${money(d.amountPesewas)} for ${d.qty}`
      : d.status === "accepted"
      ? toSeller
        ? "A buyer accepted your counter-offer"
        : `Your offer of ${money(d.agreedPesewas)} was accepted`
      : d.status === "countered"
        ? `The seller countered at ${money(d.counterPesewas)}`
        : d.status === "declined"
          ? toSeller
            ? "A buyer declined your counter-offer"
            : "Your offer was declined"
          : null
  if (!heading) return
  await c.get("checkoutRepo").enqueueNotification({
    key: `deal:${d.id}:${d.timeline.length}`,
    recipient: to,
    channel: "email",
    category: "transactional",
    body: encodeEmail(
      returnUpdateEmail({
        heading,
        paragraphs: [d.status === "accepted" && !toSeller ? `Check out by ${d.validUntil?.toUTCString() ?? "soon"} to get this price.` : "Open alkemart to see it."],
        url: toSeller ? `${base}/offers` : `${base}/product/${d.productId}`,
        cta: toSeller ? "See offers" : "See the product",
      }),
    ),
  })
}
