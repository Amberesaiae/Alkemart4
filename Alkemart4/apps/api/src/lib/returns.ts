/**
 * Returns and disputes (pilot phase 3) — the glue between the domain rules
 * (`@alkemart/domain` returns.ts), the stores, Paystack and the outbox.
 * Routes for buyers, sellers and admin all go through `applyReturnAction`,
 * so a step means the same thing whoever takes it.
 */
import {
  RETURN_REASON_LABEL,
  ReturnRuleError,
  dueReturnAction,
  nextReturnStep,
  refundRoute,
  refundShares,
  refundableMinor,
  returnOptions,
  DEFAULT_RETURN_POLICY,
  returnWaitingOn,
  type ReturnAction,
  type ReturnPolicy,
  type ReturnableOrder,
} from "@alkemart/domain"
import { refundPaystackTransaction } from "@alkemart/paystack"
import { orderReference } from "@alkemart/shared/order-ref"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { CheckoutRepository, OrderEventRow, OrderGroupRow, OrderRow, PaymentIntentRow, ReturnCaseRow } from "../checkout-repository"
import type { AppEnv, RefundPaystackTransaction } from "../context"
import { encodeEmail } from "../email"
import type { ShopPolicyStore } from "../shop-policies"
import { returnUpdateEmail } from "./email-templates"
import { formatMinorForEmail } from "./money-format"
import { autoPayAfter } from "./payouts"
import { orderEmailLinks, type OrderEmailLinks } from "./order-emails"

/** The return policy: fixed domain defaults (not admin-tunable — owner, 2026-09-27). */
export async function returnPolicy(_c?: Context<AppEnv>): Promise<ReturnPolicy> {
  return DEFAULT_RETURN_POLICY
}

/** The repository's clock (the in-memory one can be moved in tests and the sandbox). */
export function clockOf(checkout: CheckoutRepository): Date {
  const now = (checkout as { now?: () => Date }).now
  return typeof now === "function" ? now.call(checkout) : new Date()
}

/** The shop's change-of-mind days from the policy version in force when the order was placed. */
export async function shopReturnDaysAt(policies: ShopPolicyStore | undefined, sellerId: string, placedAt: Date | null): Promise<number | null> {
  if (!policies) return null
  const versions = await policies.listPolicies(sellerId).catch((): Awaited<ReturnType<ShopPolicyStore["listPolicies"]>> => [])
  const at = placedAt?.getTime() ?? Number.POSITIVE_INFINITY
  const inForce = versions.filter((v) => v.effectiveFrom.getTime() <= at).sort((a, b) => b.version - a.version)[0] ?? null
  const days = inForce?.body.returnsDays
  return typeof days === "number" && Number.isFinite(days) && days >= 0 ? Math.floor(days) : null
}

/** Paid online and the money arrived. The intent moves succeeded → completed once the order exists. */
export function isPaidOnline(intent: Pick<PaymentIntentRow, "method" | "status"> | null | undefined): boolean {
  return !!intent && intent.method !== "cod" && (intent.status === "succeeded" || intent.status === "completed")
}

export type OrderContext = {
  order: OrderRow
  group: OrderGroupRow & { createdAt?: Date }
  intent: PaymentIntentRow | null
  placedAt: Date | null
  deliveredAt: Date | null
  paidOnline: boolean
}

export async function loadOrderContext(checkout: CheckoutRepository, orderId: string): Promise<OrderContext | null> {
  const order = await checkout.getOrder(orderId)
  if (!order) return null
  const group = await checkout.getOrderGroup(order.orderGroupId)
  if (!group) return null
  const [intent, events] = await Promise.all([
    checkout.getPaymentIntent(group.paymentIntentId).catch(() => null),
    checkout.listOrderEvents([order.id]).catch((): OrderEventRow[] => []),
  ])
  const delivered = events.filter((e) => e.status === "delivered").sort((a, b) => b.at.getTime() - a.at.getTime())[0]
  return {
    order,
    group,
    intent,
    placedAt: group.createdAt ?? null,
    deliveredAt: delivered?.at ?? (order.status === "delivered" ? (group.createdAt ?? null) : null),
    paidOnline: isPaidOnline(intent),
  }
}

export function returnableOf(ctx: OrderContext, shopDays: number | null): ReturnableOrder {
  return {
    status: ctx.order.status,
    deliveredAt: ctx.deliveredAt,
    deliveryConfirmedBy: ctx.order.deliveryConfirmedBy ?? null,
    paidOnline: ctx.paidOnline,
    subtotalMinor: ctx.order.subtotalPesewas,
    refundedMinor: ctx.order.refundedPesewas ?? 0n,
    shopReturnDays: shopDays,
  }
}

/** What the buyer may ask for on this order right now (null = nothing). */
export function publicReturnOptions(o: ReturnableOrder, now: Date, policy: ReturnPolicy) {
  const reasons = returnOptions(o, now, policy)
  if (!reasons.length) return null
  return {
    reasons: reasons.map((r) => ({ reason: r.reason, label: r.label, until: r.until?.toISOString() ?? null })),
    refundablePesewas: refundableMinor(o).toString(),
    /** Change-of-mind days in force for this order (0 = none). */
    shopReturnDays: o.shopReturnDays ?? policy.defaultReturnDays,
  }
}

/** A case as buyers, sellers and admins see it. Amounts are minor-unit strings. */
export function publicReturnCase(r: ReturnCaseRow, viewer: "buyer" | "seller" | "admin", opts: { paidOut?: boolean; payOnDelivery?: boolean } = {}) {
  return {
    id: r.id,
    orderId: r.orderId,
    status: r.status,
    waitingOn: returnWaitingOn(r.status),
    respondBy: r.respondBy?.toISOString() ?? null,
    reason: r.reason,
    reasonLabel: RETURN_REASON_LABEL[r.reason],
    wish: r.wish,
    note: r.note,
    declineReason: r.declineReason,
    outcome: r.outcome,
    refund: r.refundPesewas > 0n ? { amountPesewas: r.refundPesewas.toString(), via: r.refundVia, status: r.refundStatus } : null,
    adminNote: r.adminNote,
    // Seller's share of a refund on an order already paid out, taken from the next payout.
    ...(viewer !== "buyer" ? { sellerRecoveryPesewas: r.sellerRecoveryPesewas.toString(), recovered: !!r.recoveredPayoutId, paidOut: opts.paidOut ?? null, payOnDelivery: opts.payOnDelivery ?? null } : {}),
    ...(viewer === "admin" ? { sellerId: r.sellerId, buyerEmail: r.buyerEmail } : {}),
    timeline: r.timeline.map((t) => ({ at: t.at, by: t.by, note: t.note })),
    createdAt: r.createdAt.toISOString(),
    closedAt: r.closedAt?.toISOString() ?? null,
  }
}

// ─── Doing a step ────────────────────────────────────────────────────────

export type ReturnDeps = {
  checkout: CheckoutRepository
  policy: ReturnPolicy
  links: OrderEmailLinks
  /** Seller's commission, for splitting a refund. */
  commissionBps: (sellerId: string) => Promise<number>
  refund?: RefundPaystackTransaction
  paystackSecretKey?: string | null
  /** A closed case releases the order's payout: pay the seller if it's due (automatic payouts). */
  afterClose?: (sellerId: string) => Promise<void>
}

export function returnDeps(c: Context<AppEnv>, policy: ReturnPolicy): ReturnDeps {
  let secret: string | null = null
  try {
    secret = c.get("paystackSecretKey") ?? null
  } catch {
    /* not bound on this path */
  }
  return {
    checkout: c.get("checkoutRepo"),
    policy,
    links: orderEmailLinks(c),
    commissionBps: async (sellerId) => (await c.get("authRepo").findSellerById(sellerId))?.commissionBps ?? 0,
    afterClose: (sellerId) => autoPayAfter(c, sellerId),
    refund: c.get("refundPaystackTransaction") ?? refundPaystackTransaction,
    paystackSecretKey: secret,
  }
}

function ruleError(e: unknown): never {
  if (e instanceof ReturnRuleError) throw new HTTPException(409, { message: e.message })
  throw e
}

/**
 * Apply one step to a case: the domain decides, the store saves it (compare-
 * and-swap on status), then money moves and both sides are told. Never pays
 * twice: the case is closed with the refund booked before Paystack is asked.
 */
export async function applyReturnAction(deps: ReturnDeps, row: ReturnCaseRow, action: ReturnAction): Promise<ReturnCaseRow> {
  const { checkout } = deps
  const ctx = await loadOrderContext(checkout, row.orderId)
  if (!ctx) throw new HTTPException(404, { message: "order not found" })
  const now = clockOf(checkout)
  const refundable = refundableMinor({ status: ctx.order.status, paidOnline: ctx.paidOnline, subtotalMinor: ctx.order.subtotalPesewas, refundedMinor: ctx.order.refundedPesewas ?? 0n })
  let step
  try {
    step = nextReturnStep({ status: row.status, wish: row.wish, respondBy: row.respondBy, refundableMinor: refundable }, action, now)
  } catch (e) {
    ruleError(e)
  }

  let money: Parameters<CheckoutRepository["advanceReturnCase"]>[2]["refund"]
  if (step.refundMinor > 0n) {
    const via = refundRoute(ctx.intent?.method)
    const shares = refundShares(step.refundMinor, await deps.commissionBps(row.sellerId))
    money = {
      minor: step.refundMinor,
      via,
      status: via === "provider" ? "pending" : "owed",
      // Already in a payout: the seller's share comes off their next one.
      sellerRecoveryMinor: via === "provider" && ctx.order.payoutId ? shares.sellerMinor : 0n,
      platformMinor: shares.platformMinor,
      currency: ctx.group.currency,
      intentId: ctx.intent?.id ?? null,
    }
  }
  const by = action.by
  const updated = await checkout.advanceReturnCase(row.id, row.status, {
    status: step.status,
    respondBy: step.respondBy,
    ...(step.declineReason !== undefined ? { declineReason: step.declineReason } : {}),
    ...(step.outcome !== undefined ? { outcome: step.outcome } : {}),
    ...(action.by === "admin" ? { adminNote: action.note.trim() } : {}),
    entry: { by, note: step.note },
    refund: money,
  })
  if (!updated) throw new HTTPException(409, { message: "This return has already moved on. Refresh to see where it stands." })

  let final = updated
  if (money?.via === "provider") final = (await sendProviderRefund(deps, final, ctx)) ?? final
  await notifyReturnStep(deps, final, ctx, by).catch(() => undefined)
  if (final.status === "closed") await deps.afterClose?.(final.sellerId).catch(() => undefined)
  return final
}

/** Ask Paystack to refund a closed case. Safe to call again for a failed one (admin retry). */
export async function sendProviderRefund(deps: ReturnDeps, row: ReturnCaseRow, ctx?: OrderContext | null): Promise<ReturnCaseRow | null> {
  const c = ctx ?? (await loadOrderContext(deps.checkout, row.orderId))
  const reference = c?.intent?.paystackReference
  if (!reference || !deps.refund || !deps.paystackSecretKey) {
    return deps.checkout.setReturnRefund(row.id, { status: "failed", entry: { by: "system", note: "Refund couldn't be sent automatically — alkemart will send it" } })
  }
  try {
    const r = await deps.refund({ secretKey: deps.paystackSecretKey }, { reference, amountMinor: row.refundPesewas })
    const done = r.status === "processed" || r.status === "success"
    return deps.checkout.setReturnRefund(row.id, {
      status: done ? "paid" : "pending",
      ref: r.refundId,
      entry: { by: "system", note: done ? "Refund sent" : "Refund on its way to the buyer's account" },
    })
  } catch {
    return deps.checkout.setReturnRefund(row.id, { status: "failed", entry: { by: "system", note: "The refund didn't go through — alkemart will retry" } })
  }
}

/** Apply every deadline that has passed. Timeouts never move money. Returns how many moved. */
export async function sweepDueReturns(deps: Pick<ReturnDeps, "checkout" | "policy" | "links">): Promise<number> {
  const now = clockOf(deps.checkout)
  const due = await deps.checkout.listReturnCases({ dueAt: now }).catch(() => [])
  let moved = 0
  for (const row of due) {
    const action = dueReturnAction(row, now)
    if (!action) continue
    try {
      await applyReturnAction({ ...deps, commissionBps: async () => 0 }, row, action)
      moved++
    } catch {
      /* someone else moved it first */
    }
  }
  return moved
}

// ─── Telling people ──────────────────────────────────────────────────────

/** Tell the other side about a case that was just opened. Never throws. */
export async function notifyReturnOpened(deps: Pick<ReturnDeps, "checkout" | "links" | "policy" | "commissionBps">, row: ReturnCaseRow) {
  const ctx = await loadOrderContext(deps.checkout, row.orderId).catch(() => null)
  if (ctx) await notifyReturnStep(deps as ReturnDeps, row, ctx, "buyer").catch(() => undefined)
}

const WHEN = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(d) : ""

/** One email per step to whoever needs to know. Keys make retries send once. */
async function notifyReturnStep(deps: ReturnDeps, r: ReturnCaseRow, ctx: OrderContext, by: string) {
  const { links, checkout } = deps
  const ref = orderReference(ctx.group.id)
  const money = (m: bigint) => formatMinorForEmail(m, ctx.group.currency)
  const shop = (await links.sellerName?.(r.sellerId).catch(() => null)) ?? "The seller"
  const buyerUrl = links.storefrontUrl ? `${links.storefrontUrl}/order/${ctx.group.id}` : null
  const sellerUrl = links.vendorUrl ? `${links.vendorUrl}/orders/${r.orderId}` : null
  const sellerTo = sellerUrl ? await links.sellerEmail?.(r.sellerId).catch(() => null) : null
  const step = r.timeline.length
  const send = async (who: "buyer" | "seller", heading: string, paragraphs: string[]) => {
    const to = who === "buyer" ? r.buyerEmail : sellerTo
    const url = who === "buyer" ? buyerUrl : sellerUrl
    if (!to || !url) return
    await checkout.enqueueNotification({
      key: `return:${r.id}:${step}:${who}`,
      recipient: to,
      channel: "email",
      category: "transactional",
      body: encodeEmail(returnUpdateEmail({ heading, paragraphs, url, cta: who === "buyer" ? "See your order" : "Open the order" })),
    })
  }
  const refundLine = r.refundVia === "seller" ? `${shop} will pay you back ${money(r.refundPesewas)} directly.` : `${money(r.refundPesewas)} is going back to how you paid. It can take a few days to show.`

  switch (r.status) {
    case "requested":
      return send("seller", `Return request on ${ref}`, [
        `Reason: ${RETURN_REASON_LABEL[r.reason]}. The buyer would like ${r.wish === "swap" ? "a replacement" : "their money back"}.`,
        `They say: "${r.note}"`,
        `Please answer by ${WHEN(r.respondBy)}. If you don't, alkemart will decide.`,
        ctx.intent?.method === "cod"
          ? "The buyer paid you cash, so if it ends in a refund you pay them back yourself."
          : ctx.order.payoutId
            ? "You've already been paid for this order; if it ends in a refund, your share comes off your next payout."
            : "The payment for this order waits until it's settled.",
      ])
    case "declined":
      return send("buyer", `${shop} declined your return on ${ref}`, [
        `Their reason: "${r.declineReason ?? ""}"`,
        "If you don't agree, ask alkemart to decide from your order page.",
      ])
    case "escalated":
      await send("seller", `alkemart is deciding the return on ${ref}`, [
        by === "system" ? "The deadline passed without an answer." : "The buyer asked alkemart to decide.",
        ctx.order.payoutId || ctx.intent?.method === "cod" ? "We'll look at both sides and let you know." : "We'll look at both sides and let you know. The payment for this order waits until then.",
      ])
      return send("buyer", `alkemart is looking at your return on ${ref}`, ["We'll look at both sides and let you know what we decide."])
    case "closed": {
      const decided = by === "admin" ? [`alkemart's note: "${r.adminNote ?? ""}"`] : []
      if (r.outcome === "refund") {
        await send("buyer", `Refund on ${ref}`, [refundLine, ...decided])
        if (by !== "seller") {
          await send("seller", `Return settled on ${ref}: refund`, [
            r.refundVia === "seller" ? `Please pay the buyer back ${money(r.refundPesewas)} and mark it done on the order.` : `${money(r.refundPesewas)} is being refunded to the buyer through alkemart.`,
            ...decided,
          ])
        }
        return
      }
      if (r.outcome === "swap") return send(by === "seller" ? "buyer" : "seller", `Replacement agreed on ${ref}`, ["Arrange the replacement together from the order page."])
      if (r.outcome === "declined" && by === "admin") {
        await send("buyer", `Decision on your return for ${ref}`, ["alkemart sided with the seller this time.", ...decided])
        return send("seller", `Decision on the return for ${ref}`, ["alkemart sided with you. The payment for this order continues as normal.", ...decided])
      }
      if (r.outcome === "withdrawn") return send("seller", `The buyer closed the return on ${ref}`, ["They said it's sorted. The payment for this order continues as normal."])
      return
    }
  }
}

const refundableOf = (_r: ReturnCaseRow, ctx: OrderContext) => ctx.order.subtotalPesewas - (ctx.order.refundedPesewas ?? 0n)

/**
 * Cron: apply return deadlines even when nobody opens a page (a silent
 * seller still hands the case to alkemart on time). Never throws.
 */
export async function runReturnDeadlines(env: unknown) {
  try {
    const { parseEnv } = await import("../env")
    const { primaryDb } = await import("../db")
    const { PostgresCheckoutRepository } = await import("../postgres-checkout-repository")
    const parsed = parseEnv(env as Record<string, unknown>)
    const db = primaryDb(parsed)
    const policy = DEFAULT_RETURN_POLICY
    const moved = await sweepDueReturns({
      checkout: new PostgresCheckoutRepository(db),
      policy,
      links: { storefrontUrl: parsed.STOREFRONT_URL ?? null, vendorUrl: parsed.VENDOR_URL ?? null },
    })
    console.log(JSON.stringify({ job: "return-deadlines", moved }))
  } catch (error) {
    console.error(JSON.stringify({ job: "return-deadlines", error: error instanceof Error ? error.message : String(error) }))
  }
}
