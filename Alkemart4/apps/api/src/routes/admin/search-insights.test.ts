import { describe, expect, it } from "vitest"
import { aggregateSearchLog } from "../../catalog-repository"

describe("search insights", () => {
  it("groups queries case-insensitively and ranks failed searches", () => {
    const at = (d: string) => new Date(`${d}T10:00:00Z`)
    const r = aggregateSearchLog(
      [
        { query: "iPhone 13", resultCount: 4, at: at("2026-09-24") },
        { query: "iphone  13 ", resultCount: 6, at: at("2026-09-25") },
        { query: "shea butter", resultCount: 0, at: at("2026-09-25") },
        { query: "Shea Butter", resultCount: 0, at: at("2026-09-26") },
        { query: "kente", resultCount: 0, at: at("2026-09-26") },
      ],
      30,
    )
    expect(r.searches).toBe(5)
    expect(r.zeroResultSearches).toBe(3)
    expect(r.top[0]).toEqual({ query: "iphone 13", count: 2, avgResults: 5 })
    expect(r.zero[0]).toMatchObject({ query: "shea butter", count: 2 })
    expect(r.byDay.map((d) => [d.date, d.searches, d.zero])).toEqual([["2026-09-24", 1, 0], ["2026-09-25", 2, 1], ["2026-09-26", 2, 2]])
  })
})
