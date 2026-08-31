import { describe, it, expect } from "vitest"
import { assertLeafCategory, buildNavTree } from "../taxonomy"

describe("taxonomy", () => {
  it("builds a two-level tree sorted by rank", () => {
    const tree = buildNavTree([
      { id: "1", handle: "phones-electronics", name: "Phones & Electronics", parentId: null, rank: 0 },
      { id: "2", handle: "phones", name: "Phones", parentId: "1", rank: 0 },
      { id: "3", handle: "accessories", name: "Accessories", parentId: "1", rank: 1 },
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].children.map((c) => c.handle)).toEqual(["phones", "accessories"])
  })
  it("assertLeafCategory rejects parents", () => {
    const tree = buildNavTree([
      { id: "1", handle: "phones-electronics", name: "Phones & Electronics", parentId: null, rank: 0 },
      { id: "2", handle: "phones", name: "Phones", parentId: "1", rank: 0 },
    ])
    expect(() => assertLeafCategory(tree[0])).toThrow(/leaf/i)
    expect(() => assertLeafCategory(tree[0].children[0])).not.toThrow()
  })
})
