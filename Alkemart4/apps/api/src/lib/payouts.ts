import { DEFAULT_PAYOUT_POLICY, computePayoutBatch, payableSubtotal, payoutStatusFromTransfer } from "@alkemart/domain"
import { PaystackError, createPaystackTransfer, fetchPaystackBalance, newTransferReference } from "@alkemart/paystack"
import type { Context } from "hono"
import type { AuthRepository } from "../auth-repository"
import { PayoutBlockedError, type CheckoutRepository, type PayoutRow } from "../checkout-repository"
import type { AppEnv, CreatePaystackTransfer } from "../context"

/**
 * Paying sellers: reserve the exact orders and a reference, send one
 * Paystack transfer, settle on Paystack's answer (here or by webhook).
 * Shared by admin's "Pay" / "Pay everyone ready" and automatic payouts.
 */
export type PayoutOutcome = "paid" | "sent" | "failed" | "unknown" | "otp"

export type PayoutDeps = {
  checkout: CheckoutRepository
  secretKey: string
  /** Injected in tests and the sandbox; absent → real Paystack (with a balance check first). */
  transfer?: CreatePaystackTransfer
}

export type SellerForPayout = { id: string; handle: string; commissionBps: number; recipientCode?: string | null }

export type PayOneResult =
  | { kind: "replayed"; payout: PayoutRow }
  | { kind: "blocked"; status: 400 | 409; message: string }
  | { kind: "sent"; payout: PayoutRow; outcome: PayoutOutcome }

/** Send a reserved payout (first attempt or retry — always its own reference) and record the answer. */
export async function sendPayout(deps: PayoutDeps, payout: PayoutRow, recipientCode: string, handle: string, actor: string): Promise<{ payout: PayoutRow; outcome: PayoutOutcome }> {
  const { checkout } = deps
  const transferFn = deps.transfer ?? createPaystackTransfer
  try {
    const t = await transferFn(
      { secretKey: deps.secretKey },
      { amountPesewas: payout.netPesewas, recipientCode, reference: payout.paystackReference!, reason: `alkemart payout ${handle}` },
    )
    const to = payoutStatusFromTransfer(t.status)
    if (to === "paid") {
      await checkout.markPayoutSent(payout.id, t.transferCode, actor)
      const r = await checkout.settlePayout(payout.id, "paid", { actor: "paystack", transferCode: t.transferCode })
      return { payout: r.payout ?? payout, outcome: "paid" }
    }
    if (to === "failed") {
      const r = await checkout.settlePayout(payout.id, "failed", { actor: "paystack", reason: `Paystack: ${t.status}` })
      return { payout: r.payout ?? payout, outcome: "failed" }
    }
    const sent = (await checkout.markPayoutSent(payout.id, t.transferCode, actor)) ?? payout
    if (t.status.toLowerCase() === "otp") {
      await checkout.addPayoutEvent(payout.id, "checked", "system", "Paystack wants an OTP before sending")
      return { payout: sent, outcome: "otp" }
    }
    return { payout: sent, outcome: "sent" }
  } catch (err) {
    if (err instanceof PaystackError && err.definite) {
      // Paystack answered "no" (bad recipient, low balance…): nothing was sent.
      const r = await checkout.settlePayout(payout.id, "failed", { actor: "paystack", reason: err.message })
      return { payout: r.payout ?? payout, outcome: "failed" }
    }
    // Timeout / network / 5xx: we don't know. Leave it pending; verify by reference.
    await checkout.addPayoutEvent(payout.id, "checked", "system", `No answer from Paystack: ${err instanceof Error ? err.message : "unknown error"}`)
    return { payout, outcome: "unknown" }
  }
}

/** Reserve and send one seller's released money. Never sends twice: a payout on its way is returned instead. */
export async function payOne(deps: PayoutDeps, seller: SellerForPayout, actor: string): Promise<PayOneResult> {
  const { checkout, secretKey } = deps
  if (!seller.recipientCode) return { kind: "blocked", status: 400, message: "seller missing Paystack recipient_code" }

  const recent = await checkout.listPayoutsForSeller(seller.id).catch((): PayoutRow[] => [])
  const inflight = recent.find((p) => p.status === "pending" || p.status === "processing")
  if (inflight) return { kind: "replayed", payout: inflight }

  // Balance check on the real Paystack path only. A failed lookup never
  // blocks — Paystack would refuse anyway.
  if (!deps.transfer) {
    const unpaid = await checkout.listDeliveredUnpaidOrders(seller.id).catch(() => [])
    const need = computePayoutBatch(seller.id, seller.commissionBps, unpaid.map((o) => ({ orderId: o.id, sellerId: o.sellerId, subtotalPesewas: payableSubtotal(o) }))).netPesewas
    const balances = await fetchPaystackBalance({ secretKey }).catch(() => null)
    const ghs = balances?.find((b) => b.currency === "GHS")
    if (ghs && BigInt(ghs.balanceMinor) < need) {
      return {
        kind: "blocked",
        status: 409,
        message: `Paystack balance is GH₵${(ghs.balanceMinor / 100).toFixed(2)} but this payout needs GH₵${(Number(need) / 100).toFixed(2)}. Top up Paystack first.`,
      }
    }
  }

  let reserved: PayoutRow
  try {
    reserved = await checkout.reservePayout({ sellerId: seller.id, commissionBps: seller.commissionBps, reference: newTransferReference(), createdBy: actor })
  } catch (err) {
    if (err instanceof PayoutBlockedError) {
      return err.code === "nothing_payable" ? { kind: "blocked", status: 400, message: "no delivered unpaid orders" } : { kind: "blocked", status: 409, message: err.message }
    }
    throw err
  }
  const { payout, outcome } = await sendPayout(deps, reserved, seller.recipientCode, seller.handle, actor)
  return { kind: "sent", payout, outcome }
}

export const AUTO_PAYOUT_ACTOR = "system:auto"

/**
 * Automatic payout for one seller: sends whatever is released right now.
 * Quiet no-op when auto payouts are off, the seller has no payout account,
 * nothing is released yet, or a payout is already on its way.
 */
export async function autoPaySeller(deps: PayoutDeps & { authRepo: AuthRepository }, sellerId: string): Promise<PayOneResult | null> {
  if (!DEFAULT_PAYOUT_POLICY.autoPayout) return null
  const seller = await deps.authRepo.findSellerById(sellerId).catch(() => null)
  if (!seller?.recipientCode) return null
  const released = await deps.checkout.listDeliveredUnpaidOrders(sellerId).catch(() => [])
  if (released.length === 0) return null
  const r = await payOne(deps, seller, AUTO_PAYOUT_ACTOR)
  console.log(JSON.stringify({ job: "auto-payout", sellerId, result: r.kind, outcome: r.kind === "sent" ? r.outcome : null }))
  return r
}

/** Request-scoped deps; null when Paystack isn't configured. */
export function payoutDeps(c: Context<AppEnv>): (PayoutDeps & { authRepo: AuthRepository }) | null {
  const secretKey = c.get("paystackSecretKey")
  if (!secretKey) return null
  return { checkout: c.get("checkoutRepo"), secretKey, transfer: c.get("createPaystackTransfer"), authRepo: c.get("authRepo") }
}

/**
 * Pay this seller now if money was just released. Runs after the response
 * when the runtime allows (waitUntil), so the buyer or seller never waits on
 * Paystack; never throws into the request.
 */
export async function autoPayAfter(c: Context<AppEnv>, sellerId: string): Promise<void> {
  const deps = payoutDeps(c)
  if (!deps) return
  const run = autoPaySeller(deps, sellerId).catch((err) => {
    console.error(JSON.stringify({ job: "auto-payout", sellerId, error: err instanceof Error ? err.message : String(err) }))
    return null
  })
  let ctx: { waitUntil(p: Promise<unknown>): void } | null = null
  try {
    ctx = c.executionCtx
  } catch {
    ctx = null
  }
  if (ctx) ctx.waitUntil(run)
  else await run
}
