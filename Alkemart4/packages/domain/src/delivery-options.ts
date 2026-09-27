import { haversineKm, nearestRegionByCoords, resolveRegionId } from "@alkemart/shared/ghana"

/**
 * How a seller gets an order to the buyer, and what it costs — Ghana-style:
 * the seller's own rider priced by zone (same town / same region / other
 * regions), or the buyer collects from the shop.
 *
 * Fees are quoted from where the buyer is and frozen on the order at checkout,
 * so a later change to the seller's prices never changes an order.
 */

export type FulfillmentMethod = "delivery" | "pickup"
export type DeliveryZone = "town" | "region" | "country"

export type FulfillmentSettings = {
  /** Fee per zone in pesewas; null = doesn't deliver there. */
  delivery: Record<DeliveryZone, bigint | null>
  pickup: boolean
}

export type Whereabouts = {
  city?: string | null
  /** Region id ("GH07") or display name. */
  region?: string | null
  lat?: number | null
  lng?: number | null
}

export type FulfillmentOption =
  | { method: "delivery"; zone: DeliveryZone; feePesewas: bigint }
  | { method: "pickup"; feePesewas: 0n }

/** Within this distance two pinned places count as the same town. */
export const SAME_TOWN_KM = 15

export const ZONE_LABEL: Record<DeliveryZone, string> = {
  town: "Same town",
  region: "Same region",
  country: "Other regions",
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/\s+(municipal|metropolitan)?\s*(district|assembly)$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const regionIdOf = (w: Whereabouts): string | null => {
  const byName = w.region ? resolveRegionId(w.region) : null
  if (byName) return byName
  return w.lat != null && w.lng != null ? (nearestRegionByCoords(w.lat, w.lng)?.id ?? null) : null
}

/** Which zone the buyer is in, seen from the seller. Pins win over typed names. */
export function deliveryZone(seller: Whereabouts, buyer: Whereabouts, sameTownKm: number = SAME_TOWN_KM): DeliveryZone {
  const pinned = seller.lat != null && seller.lng != null && buyer.lat != null && buyer.lng != null
  if (pinned && haversineKm(seller.lat!, seller.lng!, buyer.lat!, buyer.lng!) <= sameTownKm) return "town"
  const sRegion = regionIdOf(seller)
  const bRegion = regionIdOf(buyer)
  if (!pinned && norm(seller.city) && norm(seller.city) === norm(buyer.city) && (!sRegion || !bRegion || sRegion === bRegion)) {
    return "town"
  }
  if (sRegion && bRegion && sRegion === bRegion) return "region"
  return "country"
}

/** What the buyer can choose from this seller. Empty = can't be served. */
export function fulfillmentOptions(
  settings: FulfillmentSettings,
  seller: Whereabouts,
  buyer: Whereabouts,
  policy: Pick<DeliveryPolicy, "sameTownKm"> = DEFAULT_DELIVERY_POLICY,
): FulfillmentOption[] {
  const out: FulfillmentOption[] = []
  const zone = deliveryZone(seller, buyer, policy.sameTownKm)
  const fee = settings.delivery[zone]
  if (fee != null) out.push({ method: "delivery", zone, feePesewas: fee < 0n ? 0n : fee })
  if (settings.pickup) out.push({ method: "pickup", feePesewas: 0n })
  return out
}

type StoredSettings = {
  delivery?: Partial<Record<DeliveryZone, string | null>>
  pickup?: boolean
}

/**
 * Read settings kept in `sellers.metadata.fulfillment`. Sellers who never set
 * zones keep their single legacy fee everywhere and no pickup — exactly what
 * they had before.
 */
export function fulfillmentSettingsFrom(stored: unknown, legacyFeePesewas: bigint): FulfillmentSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as StoredSettings
  const read = (z: DeliveryZone): bigint | null => {
    if (!s.delivery || !(z in s.delivery)) return legacyFeePesewas
    const v = s.delivery[z]
    return v == null || !/^\d+$/.test(v) ? null : BigInt(v)
  }
  return { delivery: { town: read("town"), region: read("region"), country: read("country") }, pickup: s.pickup === true }
}

export function fulfillmentSettingsToStored(s: FulfillmentSettings): Required<StoredSettings> {
  const w = (v: bigint | null) => (v == null ? null : v.toString())
  return { delivery: { town: w(s.delivery.town), region: w(s.delivery.region), country: w(s.delivery.country) }, pickup: s.pickup }
}

// ─── Handover code ───────────────────────────────────────────────────────

/** Wrong codes allowed before code checking stops for that order (anti-guessing). */
export const HANDOVER_MAX_FAILURES = 5

/** A 4-digit code, uniformly random (rejection sampling, no modulo bias). */
export function newHandoverCode(random: (buf: Uint16Array<ArrayBuffer>) => Uint16Array<ArrayBuffer> = (b) => crypto.getRandomValues(b)): string {
  const buf = new Uint16Array(1)
  for (;;) {
    const n = random(buf)[0]!
    if (n < 60000) return String(n % 10000).padStart(4, "0")
  }
}

/** Constant-time compare of two short codes; tolerant of spaces the buyer reads out. */
export function handoverMatches(expected: string, given: string): boolean {
  const g = given.replace(/\D/g, "")
  if (g.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ g.charCodeAt(i)
  return diff === 0
}

// ─── Payout release after delivery ───────────────────────────────────────

const HOUR = 60 * 60 * 1000

/** Who confirmed a delivery. Anything the buyer did counts as proof. */
export type DeliveryConfirmedBy = "buyer_code" | "buyer" | "seller"

/**
 * Trust by default: a seller can always mark an order delivered. What changes
 * is when the money for an online-paid order is released. With proof from
 * the buyer (their handover code, or "I got it") it's released at once.
 * On the seller's word alone the buyer gets a short window to report a
 * problem first — sized to the order, so same-day orders don't wait days.
 */
export const REPORT_WINDOW_HOURS = { sameDay: 24, multiDay: 48 } as const

export function payoutReleaseAt(
  o: {
    deliveredAt: Date
    confirmedBy?: DeliveryConfirmedBy | null
    placedAt?: Date | null
    deliverLatest?: Date | null
  },
  policy: Pick<DeliveryPolicy, "reportWindowHours"> = DEFAULT_DELIVERY_POLICY,
): Date {
  if (o.confirmedBy === "buyer_code" || o.confirmedBy === "buyer") return o.deliveredAt
  const sameDay = !!(o.placedAt && o.deliverLatest && o.deliverLatest.getTime() - o.placedAt.getTime() <= 24 * HOUR)
  const hours = sameDay ? policy.reportWindowHours.sameDay : policy.reportWindowHours.multiDay
  return new Date(o.deliveredAt.getTime() + hours * HOUR)
}

// ─── Policy (admin-tunable) ──────────────────────────────────────────────

/**
 * The numbers behind delivery trust, in one place. Defaults live here; admin
 * can change them (stored in platform_settings "delivery_policy"). Apps never
 * repeat these numbers — they show what the API computed.
 */
export type DeliveryPolicy = {
  /** Pinned buyer within this many km of the seller = same-town price. */
  sameTownKm: number
  /** Wrong handover codes before code checking stops for an order. */
  handoverMaxFailures: number
  /** Hours the buyer has to report a problem before a seller-only delivery is paid out. */
  reportWindowHours: { sameDay: number; multiDay: number }
}

export const DEFAULT_DELIVERY_POLICY: DeliveryPolicy = {
  sameTownKm: SAME_TOWN_KM,
  handoverMaxFailures: HANDOVER_MAX_FAILURES,
  reportWindowHours: { ...REPORT_WINDOW_HOURS },
}

const LIMITS = { sameTownKm: [1, 100], handoverMaxFailures: [1, 20], reportWindowHours: [0, 168] } as const

/** Validate an admin edit. Returns the full policy or a plain-language problem. */
export function parseDeliveryPolicy(input: unknown): { ok: true; policy: DeliveryPolicy } | { ok: false; message: string } {
  const v = (input && typeof input === "object" ? input : {}) as Partial<DeliveryPolicy>
  const merged: DeliveryPolicy = {
    ...DEFAULT_DELIVERY_POLICY,
    ...v,
    reportWindowHours: { ...DEFAULT_DELIVERY_POLICY.reportWindowHours, ...(v.reportWindowHours ?? {}) },
  }
  const within = (n: unknown, [lo, hi]: readonly [number, number]) => typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi
  if (!within(merged.sameTownKm, LIMITS.sameTownKm)) return { ok: false, message: "Same-town distance must be 1–100 km." }
  if (!within(merged.handoverMaxFailures, LIMITS.handoverMaxFailures) || !Number.isInteger(merged.handoverMaxFailures)) {
    return { ok: false, message: "Code tries must be a whole number from 1 to 20." }
  }
  for (const k of ["sameDay", "multiDay"] as const) {
    if (!within(merged.reportWindowHours[k], LIMITS.reportWindowHours)) return { ok: false, message: "Report windows must be 0–168 hours." }
  }
  return { ok: true, policy: merged }
}

/** Stored policy with defaults for anything missing or invalid. Never throws. */
export function deliveryPolicyFrom(stored: unknown): DeliveryPolicy {
  const r = parseDeliveryPolicy(stored ?? {})
  return r.ok ? r.policy : DEFAULT_DELIVERY_POLICY
}
