import { describe, expect, it } from "vitest"
import {
  CANONICAL_NAMES,
  formatSlugTitle,
  resolveSubCategories,
} from "../catalog-nav"

describe("category visual rail and subcategory resolution", () => {
  it("resolves canonical department names", () => {
    expect(CANONICAL_NAMES["phones-electronics"]).toBe("Phones & Electronics")
    expect(CANONICAL_NAMES["food-groceries"]).toBe("Food & Groceries")
    expect(CANONICAL_NAMES["fashion-apparel"]).toBe("Fashion & Apparel")
  })

  it("formats slug titles cleanly", () => {
    expect(formatSlugTitle("phones-electronics")).toBe("Phones Electronics")
    expect(formatSlugTitle("groceries")).toBe("Groceries")
    expect(formatSlugTitle("")).toBe("Category")
  })

  it("for phones-electronics: omits duplicate 'phones' child chip so subcategories are directly 'Accessories', 'Computing', 'TVs & Audio', 'Appliances'", () => {
    // Seeded canonical fallback
    const subCats = resolveSubCategories(null, [], "phones-electronics")
    expect(subCats.map((s) => s.label)).toEqual([
      "Accessories",
      "Computing",
      "TVs & Audio",
      "Appliances",
    ])
    // Must NOT contain 'phones'
    expect(subCats.some((s) => s.id === "phones" || s.handle === "phones")).toBe(false)
    // First child is Accessories
    expect(subCats[0].label).toBe("Accessories")
  })

  it("filters out duplicate 'phones' even when provided by API category children", () => {
    const parentCategory = {
      id: "cat_pe_123",
      handle: "phones-electronics",
      name: "Phones & Electronics",
    }
    const apiCategories = [
      { id: "sub_1", name: "Phones", handle: "phones", parentCategoryId: "cat_pe_123" },
      { id: "sub_2", name: "Accessories", handle: "accessories", parentCategoryId: "cat_pe_123" },
      { id: "sub_3", name: "Computing", handle: "computing", parentCategoryId: "cat_pe_123" },
    ]

    const subCats = resolveSubCategories(parentCategory, apiCategories)
    expect(subCats.map((s) => s.label)).toEqual(["Accessories", "Computing"])
    expect(subCats.some((s) => s.handle === "phones")).toBe(false)
  })

  it("filters out any subcategory matching the parent handle or parent name to eliminate duplicate verbosity", () => {
    const parent = {
      id: "cat_food_1",
      handle: "food-groceries",
      name: "Food & Groceries",
    }
    const apiCategories = [
      { id: "sub_dup", name: "Food & Groceries", handle: "food-groceries", parentCategoryId: "cat_food_1" },
      { id: "sub_staples", name: "Staples", handle: "staples", parentCategoryId: "cat_food_1" },
    ]

    const subCats = resolveSubCategories(parent, apiCategories)
    expect(subCats.map((s) => s.label)).toEqual(["Staples"])
  })
})
