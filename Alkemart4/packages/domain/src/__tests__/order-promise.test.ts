import { describe, expect, it } from "vitest"
import { freezePromise, promiseStatus, validateDeliveryPromise } from "../order-promise"

const placed = new Date("2026-09-25T10:00:00Z")
const h = (n: number) => new Date(placed.getTime() + n * 3_600_000)

describe("delivery promises", () => {
  it("freezes a day range with a dispatch deadline", () => {
    const f = freezePromise(placed, { days: { min: 1, max: 3 }, dispatchHours: 12 })
    expect(f.dispatchBy).toEqual(h(12))
    expect(f.deliverEarliest).toEqual(h(24))
    expect(f.deliverLatest).toEqual(h(72))
  })

  it("same-day minutes deliver by placement + minutes", () => {
    const f = freezePromise(placed, { minutes: 60 })
    expect(f.deliverLatest).toEqual(h(1))
    expect(f.deliverEarliest).toBeNull()
  })

  it("no declared promise still sets a 24h dispatch deadline and no delivery date", () => {
    const f = freezePromise(placed, null)
    expect(f.dispatchBy).toEqual(h(24))
    expect(f.deliverLatest).toBeNull()
  })

  it("rejects contradictory or silly promises", () => {
    expect(validateDeliveryPromise({ minutes: 60, days: { min: 1, max: 2 } })).toMatch(/not both/)
    expect(validateDeliveryPromise({ days: { min: 4, max: 2 } })).toMatch(/earliest/)
    expect(validateDeliveryPromise({ days: { min: 1, max: 90 } })).toMatch(/30 days/)
    expect(validateDeliveryPromise({ dispatchHours: 5 })).toMatch(/Dispatch/)
    expect(validateDeliveryPromise({ days: { min: 1, max: 3 }, dispatchHours: 24 })).toBeNull()
  })

  it("reports lateness against the frozen promise", () => {
    const f = freezePromise(placed, { days: { min: 1, max: 2 } })
    expect(promiseStatus("placed", f, h(1))).toBe("on_track")
    expect(promiseStatus("placed", f, h(25))).toBe("dispatch_late")
    expect(promiseStatus("shipped", f, h(49))).toBe("delivery_late")
    expect(promiseStatus("delivered", f, h(100))).toBe("done")
  })
})
