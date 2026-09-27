/**
 * Delivery promises — what a seller commits to, frozen onto each order at
 * checkout so later setting changes never rewrite a promise already made.
 *
 * Market-agnostic: plain durations, no country, no calendar holidays. A seller
 * promises EITHER a same-day band in minutes (quick commerce) OR a range of
 * days; plus how fast they dispatch.
 */

export type DeliveryPromise = {
  /** Same-day shops: one published band (20…120). */
  minutes?: number | null
  /** Everyone else: calendar days from order to door, e.g. { min: 1, max: 3 }. */
  days?: { min: number; max: number } | null
  /** Hours from order to hand-over to the rider. Defaults to 24. */
  dispatchHours?: number | null
}

export type FrozenPromise = {
  dispatchBy: Date
  deliverEarliest: Date | null
  deliverLatest: Date | null
}

export const DEFAULT_DISPATCH_HOURS = 24
export const MAX_PROMISE_DAYS = 30
export const DISPATCH_HOUR_OPTIONS = [2, 6, 12, 24, 48, 72] as const

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Validate a promise the seller submits. Returns an error message or null. */
export function validateDeliveryPromise(p: DeliveryPromise): string | null {
  if (p.minutes != null && p.days != null) return "Choose same-day minutes or a range of days, not both"
  if (p.days != null) {
    const { min, max } = p.days
    if (!Number.isInteger(min) || !Number.isInteger(max)) return "Days must be whole numbers"
    if (min < 0 || max < 1) return "Delivery takes at least a day (use minutes for same-day)"
    if (min > max) return "The earliest day can't be after the latest"
    if (max > MAX_PROMISE_DAYS) return `Keep promises within ${MAX_PROMISE_DAYS} days`
  }
  if (p.dispatchHours != null && !(DISPATCH_HOUR_OPTIONS as readonly number[]).includes(p.dispatchHours)) {
    return `Dispatch time must be one of ${DISPATCH_HOUR_OPTIONS.join(", ")} hours`
  }
  return null
}

/** The promise for one order, computed at placement. */
export function freezePromise(placedAt: Date, p: DeliveryPromise | null | undefined): FrozenPromise {
  const dispatchHours = p?.dispatchHours ?? DEFAULT_DISPATCH_HOURS
  const t = placedAt.getTime()
  if (p?.minutes != null) {
    const by = new Date(t + p.minutes * 60_000)
    return { dispatchBy: by, deliverEarliest: null, deliverLatest: by }
  }
  if (p?.days != null) {
    return {
      dispatchBy: new Date(t + dispatchHours * HOUR),
      deliverEarliest: new Date(t + Math.max(p.days.min, 0) * DAY),
      deliverLatest: new Date(t + p.days.max * DAY),
    }
  }
  // No declared delivery time: only the dispatch deadline is promised.
  return { dispatchBy: new Date(t + dispatchHours * HOUR), deliverEarliest: null, deliverLatest: null }
}

export type PromiseStatus = "on_track" | "dispatch_late" | "delivery_late" | "done"

/** Where an order stands against its promise, for badges and alerts. */
export function promiseStatus(
  status: "placed" | "shipped" | "delivered" | "cancelled",
  promise: FrozenPromise | { dispatchBy: Date | null; deliverLatest: Date | null },
  now: Date,
): PromiseStatus {
  if (status === "delivered" || status === "cancelled") return "done"
  if (status === "placed" && promise.dispatchBy && now > promise.dispatchBy) return "dispatch_late"
  if (promise.deliverLatest && now > promise.deliverLatest) return "delivery_late"
  return "on_track"
}
