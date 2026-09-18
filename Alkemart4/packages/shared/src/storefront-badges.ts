/**
 * The storefront badge vocabulary.
 *
 * Every badge here is *computed* from data the platform already holds —
 * ratings, review counts, opening hours, a declared delivery band. None of
 * them is a free-text field a vendor can fill in. The moment "Top rated" is
 * something a seller can type, every badge on the page stops meaning
 * anything, including the honest ones.
 *
 * Shared between the API (which stamps badges onto store DTOs) and the UI
 * (which renders them), so a badge cannot be described one way in a response
 * and drawn another way on a card.
 */

export type BadgeTone = "earned" | "good" | "warn" | "neutral"

export type StorefrontBadge = {
  /** Stable machine id — analytics and tests key off this, never the label. */
  id: BadgeId
  label: string
  tone: BadgeTone
}

export type BadgeId =
  | "top_rated"
  | "fast_delivery"
  | "closing_soon"
  | "opens_later"
  | "paused"
  | "new_shop"

/* ------------------------------------------------------------------ */
/* Delivery bands                                                      */
/* ------------------------------------------------------------------ */

/**
 * Coarse bands, not a live estimate.
 *
 * A single flat number per shop is easy for a vendor to honour and easy for a
 * buyer to read. Anything finer would be a promise the platform cannot keep,
 * because nothing here models traffic, rider supply or basket size.
 */
export const DELIVERY_MINUTE_BANDS = [20, 30, 40, 50, 60, 90, 120] as const

export type DeliveryMinutes = (typeof DELIVERY_MINUTE_BANDS)[number]

/** A shop at or under this is worth calling out. */
export const FAST_DELIVERY_MAX_MINUTES = 30

export function isDeliveryBand(value: unknown): value is DeliveryMinutes {
  return (
    typeof value === "number" &&
    (DELIVERY_MINUTE_BANDS as readonly number[]).includes(value)
  )
}

/** Nearest legal band at or above a raw figure — never rounds optimistically. */
export function coerceDeliveryBand(value: unknown): DeliveryMinutes | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null
  for (const band of DELIVERY_MINUTE_BANDS) {
    if (value <= band) return band
  }
  return DELIVERY_MINUTE_BANDS[DELIVERY_MINUTE_BANDS.length - 1]!
}

export function deliveryLabel(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null
  return `${minutes} min delivery`
}

/* ------------------------------------------------------------------ */
/* Ratings                                                             */
/* ------------------------------------------------------------------ */

/**
 * "Top rated" needs both a high score and enough reviews to mean it. A single
 * five-star review is not a track record, and letting it earn the badge is the
 * fastest way to make the badge worthless.
 */
export const TOP_RATED_MIN_AVG = 4.5
export const TOP_RATED_MIN_COUNT = 10

export function isTopRated(
  ratingAvg: number | null | undefined,
  ratingCount: number | null | undefined,
): boolean {
  if (ratingAvg == null || !Number.isFinite(ratingAvg)) return false
  return ratingAvg >= TOP_RATED_MIN_AVG && (ratingCount ?? 0) >= TOP_RATED_MIN_COUNT
}

/* ------------------------------------------------------------------ */
/* Opening hours                                                       */
/* ------------------------------------------------------------------ */

export type ShopHours = { days: string; open: string; close: string }

/** Warn this long before closing — enough to still place an order. */
export const CLOSING_SOON_MINUTES = 60

const DAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/** Minutes past midnight, or null when the value is not "HH:MM". */
function parseClock(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Does `hours.days` cover this weekday? Accepts the same grammar the vendor
 * form validates: "Daily", "Mon-Fri", "Mon,Wed,Fri", "Sat-Sun".
 */
export function coversDay(days: string, weekday: number): boolean {
  const spec = days.trim()
  if (!spec) return false
  if (spec.toLowerCase() === "daily") return true
  for (const part of spec.split(",")) {
    const range = part.trim().split("-")
    const from = DAY_INDEX[range[0] ?? ""]
    if (from == null) continue
    if (range.length === 1) {
      if (from === weekday) return true
      continue
    }
    const to = DAY_INDEX[range[1] ?? ""]
    if (to == null) continue
    // Wrap-around ranges like "Sat-Sun" or "Fri-Mon" stay contiguous.
    if (from <= to) {
      if (weekday >= from && weekday <= to) return true
    } else if (weekday >= from || weekday <= to) {
      return true
    }
  }
  return false
}

export type OpenState =
  | { state: "open"; closesInMinutes: number }
  | { state: "closed"; opensAt: string | null }
  | { state: "unknown" }

/**
 * Where a shop is in its own trading day.
 *
 * `now` is passed in rather than read from the clock so this stays pure and
 * testable, and so the API can compute it in the shop's timezone rather than
 * the server's.
 */
export function openState(hours: ShopHours | null | undefined, now: Date): OpenState {
  if (!hours) return { state: "unknown" }
  const open = parseClock(hours.open)
  const close = parseClock(hours.close)
  if (open == null || close == null) return { state: "unknown" }

  const weekday = now.getDay()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const tradingToday = coversDay(hours.days, weekday)

  // Overnight shops ("22:00"–"02:00") belong to the day they opened on.
  const overnight = close <= open
  if (overnight) {
    const inEvening = tradingToday && minutes >= open
    const inMorning = coversDay(hours.days, (weekday + 6) % 7) && minutes < close
    if (inEvening) return { state: "open", closesInMinutes: 24 * 60 - minutes + close }
    if (inMorning) return { state: "open", closesInMinutes: close - minutes }
    return { state: "closed", opensAt: hours.open }
  }

  if (tradingToday && minutes >= open && minutes < close) {
    return { state: "open", closesInMinutes: close - minutes }
  }
  return { state: "closed", opensAt: hours.open }
}

/** "Get it from 7:00 AM" — turns a closed shop into a pre-order, not a dead end. */
export function opensAtLabel(clock: string | null | undefined): string | null {
  if (!clock) return null
  const minutes = parseClock(clock)
  if (minutes == null) return null
  const h24 = Math.floor(minutes / 60)
  const mm = String(minutes % 60).padStart(2, "0")
  const suffix = h24 < 12 ? "AM" : "PM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `Get it from ${h12}:${mm} ${suffix}`
}

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

export type SellerBadgeInput = {
  ratingAvg?: number | null
  ratingCount?: number | null
  deliveryMinutes?: number | null
  hours?: ShopHours | null
  availability?: "open" | "paused" | null
  /** ISO date the shop joined — drives "New shop". */
  memberSince?: string | null
}

/** A shop younger than this is new, and saying so is fairer than silence. */
export const NEW_SHOP_MAX_DAYS = 30

/**
 * The badges one shop has earned, most important first.
 *
 * Capped by the caller, not here — a card that shows everything shows nothing.
 */
export function sellerBadges(input: SellerBadgeInput, now: Date): StorefrontBadge[] {
  const badges: StorefrontBadge[] = []

  if (input.availability === "paused") {
    // A paused shop is the only fact that matters; nothing else is actionable.
    return [{ id: "paused", label: "Closed for now", tone: "neutral" }]
  }

  if (isTopRated(input.ratingAvg, input.ratingCount)) {
    badges.push({ id: "top_rated", label: "Top rated", tone: "earned" })
  }

  if (
    input.deliveryMinutes != null &&
    Number.isFinite(input.deliveryMinutes) &&
    input.deliveryMinutes > 0 &&
    input.deliveryMinutes <= FAST_DELIVERY_MAX_MINUTES
  ) {
    badges.push({ id: "fast_delivery", label: "Fast delivery", tone: "good" })
  }

  const open = openState(input.hours, now)
  if (open.state === "open" && open.closesInMinutes <= CLOSING_SOON_MINUTES) {
    badges.push({ id: "closing_soon", label: "Closing soon", tone: "warn" })
  } else if (open.state === "closed") {
    const label = opensAtLabel(open.opensAt)
    if (label) badges.push({ id: "opens_later", label, tone: "warn" })
  }

  if (badges.length === 0 && isNewShop(input.memberSince, now)) {
    // Only when a shop has nothing else to show — otherwise "New" competes
    // with facts a buyer can actually act on.
    badges.push({ id: "new_shop", label: "New shop", tone: "neutral" })
  }

  return badges
}

export function isNewShop(memberSince: string | null | undefined, now: Date): boolean {
  if (!memberSince) return false
  const joined = Date.parse(memberSince)
  if (!Number.isFinite(joined)) return false
  const days = (now.getTime() - joined) / 86_400_000
  return days >= 0 && days <= NEW_SHOP_MAX_DAYS
}
