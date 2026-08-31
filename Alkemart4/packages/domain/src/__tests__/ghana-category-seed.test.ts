import { describe, it, expect } from "vitest"
import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { assertLeafCategory, buildNavTree } from "../taxonomy"

const ROOT_HANDLES = [
  "food-groceries",
  "beverages",
  "fashion-apparel",
  "phones-electronics",
  "home-living",
  "health-beauty",
  "baby-kids",
  "pet-care",
  "agriculture",
  "automotive",
  "services",
  "other",
] as const

const L2_BY_PARENT: Record<string, string[]> = {
  "phones-electronics": ["phones", "accessories", "computing", "tvs-audio"],
  "fashion-apparel": ["men", "women", "kids", "shoes", "bags"],
  "food-groceries": ["staples", "cooking-oil", "snacks"],
}

describe("ghana category seed fixture", () => {
  it("includes all 12 root handles", () => {
    const roots = GHANA_CATEGORY_SEED.filter((r) => r.parentId === null).map((r) => r.handle)
    expect(roots).toEqual([...ROOT_HANDLES])
  })

  it("attaches L2 under the correct parents via buildNavTree", () => {
    const tree = buildNavTree(GHANA_CATEGORY_SEED)
    expect(tree.map((n) => n.handle)).toEqual([...ROOT_HANDLES])

    for (const [parent, children] of Object.entries(L2_BY_PARENT)) {
      const node = tree.find((n) => n.handle === parent)
      expect(node, parent).toBeDefined()
      expect(node!.children.map((c) => c.handle)).toEqual(children)
    }
  })

  it("treats L2 and flat roots as leaves; branched roots are not", () => {
    const tree = buildNavTree(GHANA_CATEGORY_SEED)
    for (const root of tree) {
      if (root.handle in L2_BY_PARENT) {
        expect(() => assertLeafCategory(root)).toThrow(/leaf/i)
        for (const child of root.children) {
          expect(() => assertLeafCategory(child)).not.toThrow()
        }
      } else {
        expect(() => assertLeafCategory(root)).not.toThrow()
      }
    }
  })
})
