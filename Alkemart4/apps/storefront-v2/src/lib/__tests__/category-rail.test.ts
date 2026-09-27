import { describe, expect, it } from "vitest"
import {
  formatSlugTitle,
  resolveSubCategories,
} from "../catalog-nav"

describe("category visual rail and subcategory resolution", () => {
  it("formats slug titles cleanly", () => {
    expect(formatSlugTitle("phones-electronics")).toBe("Phones Electronics")
    expect(formatSlugTitle("groceries")).toBe("Groceries")
    expect(formatSlugTitle("")).toBe("Category")
  })

  it("returns only the API's real children, rank-ordered — never an invented list", () => {
    expect(resolveSubCategories(null, [])).toEqual([])
    const parent = { id: "pe", name: "Phones & Electronics" }
    const api = [
      { id: "b", name: "Accessories", handle: "accessories", parentCategoryId: "pe", rank: 2 },
      { id: "a", name: "Phones", handle: "phones", parentCategoryId: "pe", rank: 1 },
      { id: "x", name: "Rice", handle: "rice", parentCategoryId: "food", rank: 0 },
    ]
    expect(resolveSubCategories(parent, api).map((s) => s.label)).toEqual(["Phones", "Accessories"])
    expect(resolveSubCategories({ id: "empty", name: "Empty" }, api)).toEqual([])
  })

  it("drops a child named exactly like its parent", () => {
    const parent = { id: "f", name: "Food & Groceries" }
    const api = [
      { id: "dup", name: "Food & Groceries", parentCategoryId: "f" },
      { id: "s", name: "Staples", parentCategoryId: "f" },
    ]
    expect(resolveSubCategories(parent, api).map((s) => s.label)).toEqual(["Staples"])
  })
})
