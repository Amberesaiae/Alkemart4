import type { DeliveryPromise } from "@alkemart/domain"

/**
 * The seller's delivery promise as stored in `sellers.metadata.delivery`.
 * Untrusted JSON: anything malformed reads as "not declared".
 */
export function deliveryPromiseFromMetadata(meta: Record<string, unknown> | null | undefined): DeliveryPromise | null {
  const raw = (meta?.delivery ?? null) as { minutes?: unknown; days?: unknown; dispatchHours?: unknown } | null
  if (!raw || typeof raw !== "object") return null
  const minutes = typeof raw.minutes === "number" && raw.minutes > 0 ? raw.minutes : null
  const d = raw.days as { min?: unknown; max?: unknown } | null | undefined
  const days =
    d && typeof d.min === "number" && typeof d.max === "number" && d.min >= 0 && d.max >= d.min ? { min: d.min, max: d.max } : null
  const dispatchHours = typeof raw.dispatchHours === "number" && raw.dispatchHours > 0 ? raw.dispatchHours : null
  if (minutes == null && days == null && dispatchHours == null) return null
  return { minutes: days ? null : minutes, days, dispatchHours }
}
