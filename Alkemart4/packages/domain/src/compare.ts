/**
 * ⚖ Compare mode: a buyer picks 2–4 products and sees them side by side.
 * Opening a comparison uses one compare token. Tokens are credits, not
 * money: no cash value, not refundable, not transferable.
 *
 * Pilot rule (owner, 2026-09-27): 5 tokens on joining, topped back up to 5
 * every two weeks, free. Numbers are per market so each country can set its
 * own later; paid packs only if the market shows the need.
 */
export type CompareTokenPolicy = {
  /** Tokens on joining, and the level a refill tops back up to. */
  grant: number
  /** Days between top-ups. A top-up never takes a balance above `grant`. */
  refillDays: number
  minItems: number
  maxItems: number
}

export const DEFAULT_COMPARE_POLICY: CompareTokenPolicy = { grant: 5, refillDays: 14, minItems: 2, maxItems: 4 }

export type CompareWallet = { balance: number; refilledAt: Date }

const DAY_MS = 86_400_000

/**
 * The wallet as it stands now: a new buyer gets the grant; once the refill
 * period has passed since the last top-up, the balance is topped back up.
 */
export function walletNow(saved: CompareWallet | null, now: Date, policy: CompareTokenPolicy = DEFAULT_COMPARE_POLICY): CompareWallet {
  if (!saved) return { balance: policy.grant, refilledAt: now }
  if (now.getTime() - saved.refilledAt.getTime() >= policy.refillDays * DAY_MS) {
    return { balance: Math.max(saved.balance, policy.grant), refilledAt: now }
  }
  return saved
}

export function nextRefillAt(w: CompareWallet, policy: CompareTokenPolicy = DEFAULT_COMPARE_POLICY): Date {
  return new Date(w.refilledAt.getTime() + policy.refillDays * DAY_MS)
}

export class CompareRuleError extends Error {}

/** Spend one token; plain-words error when there are none left. */
export function spendToken(w: CompareWallet, policy: CompareTokenPolicy = DEFAULT_COMPARE_POLICY): CompareWallet {
  if (w.balance <= 0) {
    const days = Math.max(1, Math.ceil((nextRefillAt(w, policy).getTime() - Date.now()) / DAY_MS))
    throw new CompareRuleError(`You've used your compares for now. You get ${policy.grant} more in ${days} day${days === 1 ? "" : "s"}.`)
  }
  return { ...w, balance: w.balance - 1 }
}

/** 2–4 different products. Returns them de-duplicated, in the buyer's order. */
export function compareSelection(ids: readonly string[], policy: CompareTokenPolicy = DEFAULT_COMPARE_POLICY): string[] {
  const unique = [...new Set(ids.map((i) => i.trim()).filter(Boolean))]
  if (unique.length < policy.minItems) throw new CompareRuleError(`Pick at least ${policy.minItems} products to compare.`)
  if (unique.length > policy.maxItems) throw new CompareRuleError(`You can compare up to ${policy.maxItems} products at a time.`)
  return unique
}
