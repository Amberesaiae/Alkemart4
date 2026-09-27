import { describe, expect, it } from "vitest"
import {
  DEFAULT_DELIVERY_POLICY,
  deliveryPolicyFrom,
  parseDeliveryPolicy,
  payoutReleaseAt,
  deliveryZone,
  fulfillmentOptions,
  fulfillmentSettingsFrom,
  fulfillmentSettingsToStored,
  handoverMatches,
  newHandoverCode,
} from "../delivery-options"

const osu = { city: "Accra", region: "GH07", lat: 5.556, lng: -0.182 }
const madina = { city: "La-Nkwantanang-Madina", region: "Greater Accra", lat: 5.678, lng: -0.173 }
const tema = { city: "Tema", region: "Greater Accra", lat: 5.67, lng: -0.0 }
const kumasi = { city: "Kumasi", region: "Ashanti", lat: 6.69, lng: -1.62 }

describe("deliveryZone", () => {
  it("uses real distance when both are pinned", () => {
    expect(deliveryZone(osu, madina)).toBe("town") // ~14 km
    expect(deliveryZone(osu, tema)).toBe("region") // ~23 km, same region
    expect(deliveryZone(osu, kumasi)).toBe("country")
  })

  it("falls back to typed town and region", () => {
    expect(deliveryZone({ city: "Accra", region: "Greater Accra" }, { city: "accra", region: "GH07" })).toBe("town")
    expect(deliveryZone({ city: "Accra", region: "Greater Accra" }, { city: "Tema", region: "Greater Accra" })).toBe("region")
    expect(deliveryZone({ city: "Accra", region: "Greater Accra" }, { city: "Kumasi", region: "Ashanti" })).toBe("country")
  })

  it("doesn't treat a same-named town in another region as the same town", () => {
    expect(deliveryZone({ city: "Kasoa", region: "Central" }, { city: "Kasoa", region: "Ashanti" })).toBe("country")
  })

  it("works out the buyer's region from a pin when they didn't pick one", () => {
    expect(deliveryZone({ city: "Accra", region: "GH07" }, { city: "Somewhere", lat: 5.7, lng: -0.1 })).toBe("region")
  })
})

describe("fulfillmentOptions", () => {
  const settings = { delivery: { town: 3000n, region: 4500n, country: null }, pickup: true }

  it("prices by zone and adds free pickup", () => {
    expect(fulfillmentOptions(settings, osu, tema)).toEqual([
      { method: "delivery", zone: "region", feePesewas: 4500n },
      { method: "pickup", feePesewas: 0n },
    ])
  })

  it("offers only pickup where the seller doesn't deliver", () => {
    expect(fulfillmentOptions(settings, osu, kumasi)).toEqual([{ method: "pickup", feePesewas: 0n }])
    expect(fulfillmentOptions({ ...settings, pickup: false }, osu, kumasi)).toEqual([])
  })
})

describe("fulfillmentSettingsFrom", () => {
  it("keeps a seller's old single fee everywhere until they set zones", () => {
    expect(fulfillmentSettingsFrom(undefined, 3000n)).toEqual({ delivery: { town: 3000n, region: 3000n, country: 3000n }, pickup: false })
  })

  it("round-trips stored settings, including 'doesn't deliver'", () => {
    const s = { delivery: { town: 2000n, region: null, country: 9000n }, pickup: true }
    expect(fulfillmentSettingsFrom(fulfillmentSettingsToStored(s), 3000n)).toEqual(s)
  })
})

describe("handover code", () => {
  it("is four digits", () => {
    for (let i = 0; i < 50; i++) expect(newHandoverCode()).toMatch(/^\d{4}$/)
  })

  it("rejects the biased tail instead of wrapping it", () => {
    const seq = [65000, 1234]
    const code = newHandoverCode((b) => ((b[0] = seq.shift()!), b))
    expect(code).toBe("1234")
  })

  it("matches what the buyer reads out, spaces and all", () => {
    expect(handoverMatches("0427", "04 27")).toBe(true)
    expect(handoverMatches("0427", "0428")).toBe(false)
    expect(handoverMatches("0427", "427")).toBe(false)
  })
})

describe("payoutReleaseAt", () => {
  const d = (x: string) => new Date(x)
  const delivered = d("2026-10-01T15:00:00Z")
  it("releases at once when the buyer confirmed", () => {
    expect(payoutReleaseAt({ deliveredAt: delivered, confirmedBy: "buyer_code" })).toEqual(delivered)
    expect(payoutReleaseAt({ deliveredAt: delivered, confirmedBy: "buyer" })).toEqual(delivered)
  })
  it("gives a same-day order 24h for the buyer to report a problem", () => {
    const at = payoutReleaseAt({ deliveredAt: delivered, confirmedBy: "seller", placedAt: d("2026-10-01T09:00:00Z"), deliverLatest: d("2026-10-01T15:00:00Z") })
    expect(at).toEqual(d("2026-10-02T15:00:00Z"))
  })
  it("gives a multi-day or legacy order 48h", () => {
    expect(payoutReleaseAt({ deliveredAt: delivered, confirmedBy: "seller", placedAt: d("2026-09-28T09:00:00Z"), deliverLatest: d("2026-10-01T18:00:00Z") })).toEqual(d("2026-10-03T15:00:00Z"))
    expect(payoutReleaseAt({ deliveredAt: delivered })).toEqual(d("2026-10-03T15:00:00Z"))
  })
})

describe("delivery policy", () => {
  it("uses its own numbers when admin changes them", () => {
    const policy = { ...DEFAULT_DELIVERY_POLICY, reportWindowHours: { sameDay: 6, multiDay: 24 } }
    const at = payoutReleaseAt({ deliveredAt: new Date("2026-10-01T00:00:00Z"), confirmedBy: "seller" }, policy)
    expect(at).toEqual(new Date("2026-10-02T00:00:00Z"))
    expect(deliveryZone(osu, tema, 30)).toBe("town")
  })
  it("rejects out-of-range edits in plain words", () => {
    expect(parseDeliveryPolicy({ sameTownKm: 0 })).toEqual({ ok: false, message: "Same-town distance must be 1–100 km." })
    expect(parseDeliveryPolicy({ reportWindowHours: { sameDay: 500 } }).ok).toBe(false)
    expect(parseDeliveryPolicy({ handoverMaxFailures: 2.5 }).ok).toBe(false)
  })
  it("falls back to defaults for missing or broken stored values", () => {
    expect(deliveryPolicyFrom(null)).toEqual(DEFAULT_DELIVERY_POLICY)
    expect(deliveryPolicyFrom({ sameTownKm: -1 })).toEqual(DEFAULT_DELIVERY_POLICY)
    expect(deliveryPolicyFrom({ sameTownKm: 20 }).sameTownKm).toBe(20)
  })
})
