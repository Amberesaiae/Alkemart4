import { beforeEach, describe, expect, it } from "vitest"
import {
  getDeliverTo,
  hasChosenDeliverTo,
  matchesArea,
  setDeliverTo,
} from "../deliver-to"

const KEY = "alkemart.deliver-to"

describe("deliver-to persistence", () => {
  beforeEach(() => window.localStorage.clear())

  it("starts with no choice, so the IP hint is allowed to seed the area", () => {
    expect(hasChosenDeliverTo()).toBe(false)
    expect(getDeliverTo()).toBeNull()
  })

  it("records an explicit region", () => {
    setDeliverTo("Ashanti")
    expect(hasChosenDeliverTo()).toBe(true)
    expect(getDeliverTo()).toBe("Ashanti")
  })

  it('treats "show everywhere" as a real decision, not an absent one', () => {
    // The whole point of the envelope: a bare string cannot tell these apart,
    // so "everywhere" used to be re-guessed from IP on the next page view.
    setDeliverTo(null)
    expect(hasChosenDeliverTo()).toBe(true)
    expect(getDeliverTo()).toBeNull()
  })

  it("reads the legacy bare-string value as an explicit choice", () => {
    window.localStorage.setItem(KEY, "Greater Accra")
    expect(hasChosenDeliverTo()).toBe(true)
    expect(getDeliverTo()).toBe("Greater Accra")
  })

  it("discards a stale region that is no longer in the canonical list", () => {
    window.localStorage.setItem(KEY, "Brong Ahafo")
    expect(hasChosenDeliverTo()).toBe(false)
    expect(getDeliverTo()).toBeNull()
    window.localStorage.setItem(KEY, JSON.stringify({ v: 1, area: "Atlantis" }))
    expect(hasChosenDeliverTo()).toBe(false)
  })

  it("fails closed on malformed storage", () => {
    window.localStorage.setItem(KEY, "{not json")
    expect(hasChosenDeliverTo()).toBe(false)
    expect(getDeliverTo()).toBeNull()
  })
})

describe("matchesArea", () => {
  it("shows everything when no area is set", () => {
    expect(matchesArea("Ashanti", null)).toBe(true)
    expect(matchesArea(null, null)).toBe(true)
  })

  it("hides shops with no location once an area is set", () => {
    expect(matchesArea(null, "Ashanti")).toBe(false)
  })

  it("matches case and padding insensitively", () => {
    expect(matchesArea("  greater accra ", "Greater Accra")).toBe(true)
  })
})
