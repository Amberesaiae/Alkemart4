export type Pesewas = bigint & { readonly __brand: "Pesewas" }

export function asPesewas(n: number | bigint): Pesewas {
  if (typeof n === "number") {
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new Error("pesewas must be a non-negative integer")
    }
    return BigInt(n) as Pesewas
  }
  if (n < 0n) throw new Error("pesewas must be a non-negative integer")
  return n as Pesewas
}

/**
 * Currency-agnostic money (agnostic plan Phase 4). Amounts are always minor
 * units paired with an ISO-4217 code — never a bare bigint, never a float,
 * never an assumed cedi. `Pesewas` above stays for Ghana-denominated legacy
 * paths; new money code uses `Money`.
 */
export type CurrencyCode = string & { readonly __brand: "CurrencyCode" }

export function asCurrencyCode(code: string): CurrencyCode {
  const normalized = code.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error(`invalid ISO-4217 currency: ${code}`)
  return normalized as CurrencyCode
}

export type Money = {
  amountMinor: bigint
  currency: CurrencyCode
}

export function asMoney(amountMinor: number | bigint, currency: string): Money {
  if (typeof amountMinor === "number") {
    if (!Number.isFinite(amountMinor) || !Number.isInteger(amountMinor)) {
      throw new Error("money amount must be integer minor units")
    }
  }
  return { amountMinor: BigInt(amountMinor), currency: asCurrencyCode(currency) }
}

export function zeroMoney(currency: string): Money {
  return { amountMinor: 0n, currency: asCurrencyCode(currency) }
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`)
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency }
}

/** Platform fee for an amount at basis points — integer math, rounds down. */
export function feeFor(amount: Money, bps: number): Money {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error(`invalid basis points: ${bps}`)
  }
  return { amountMinor: (amount.amountMinor * BigInt(bps)) / 10_000n, currency: amount.currency }
}
