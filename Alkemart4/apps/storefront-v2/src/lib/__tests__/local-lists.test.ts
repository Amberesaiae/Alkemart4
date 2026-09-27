import { describe, expect, it } from "vitest"
import { pushRecent } from "../search-history"
import { toggleSaved } from "../wishlist"

describe("recent searches (device-local)", () => {
  it("puts the newest first, de-dupes case-insensitively, caps length", () => {
    let list: string[] = []
    list = pushRecent(list, "iphone")
    list = pushRecent(list, "rice")
    list = pushRecent(list, "iPhone")
    expect(list).toEqual(["iPhone", "rice"])
    expect(pushRecent(list, "   ")).toBe(list)
    const long = Array.from({ length: 20 }, (_, i) => `q${i}`).reduce(
      (acc, q) => pushRecent(acc, q),
      [] as string[],
    )
    expect(long).toHaveLength(8)
  })
})

describe("saved items (device-local)", () => {
  it("toggles an item in and out", () => {
    const item = { id: "p1", title: "Phone" }
    const now = new Date("2026-09-25T00:00:00Z")
    const saved = toggleSaved([], item, now)
    expect(saved).toEqual([{ ...item, savedAt: now.toISOString() }])
    expect(toggleSaved(saved, item)).toEqual([])
  })
})
