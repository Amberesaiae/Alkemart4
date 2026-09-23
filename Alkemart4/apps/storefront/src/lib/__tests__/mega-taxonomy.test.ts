import { describe, expect, it } from "vitest"
import { MEGA_TAXONOMY } from "@/lib/mega-taxonomy"

describe("MEGA_TAXONOMY", () => {
  it("defines 4-column mega menu layout for Phones & Electronics matching Jumia reference", () => {
    const electronics = MEGA_TAXONOMY["phones-electronics"]
    expect(electronics).toBeDefined()
    expect(electronics.title).toBe("Phones & Electronics")
    expect(electronics.columns).toHaveLength(4)

    // Column 1: Mobile Phones & Accessories
    const col1Titles = electronics.columns[0].sections.map((s) => s.title)
    expect(col1Titles).toContain("MOBILE PHONES")
    expect(col1Titles).toContain("MOBILE ACCESSORIES")

    // Column 2: Top Phone Brands
    const col2Titles = electronics.columns[1].sections.map((s) => s.title)
    expect(col2Titles).toContain("TOP PHONE BRANDS")
    const brandLabels = electronics.columns[1].sections[0].items.map((i) => i.label)
    expect(brandLabels).toContain("Samsung")
    expect(brandLabels).toContain("Apple")
    expect(brandLabels).toContain("Tecno")
    expect(brandLabels).toContain("Infinix")

    // Column 3: Top Products
    const col3Titles = electronics.columns[2].sections.map((s) => s.title)
    expect(col3Titles).toContain("TOP PRODUCTS")
    const productLabels = electronics.columns[2].sections[0].items.map((i) => i.label)
    expect(productLabels).toContain("iPhone 15")
    expect(productLabels).toContain("Samsung Galaxy S24")
    expect(productLabels).toContain("Tecno Camon 30")

    // Column 4: Computing & Audio
    const col4Titles = electronics.columns[3].sections.map((s) => s.title)
    expect(col4Titles).toContain("COMPUTING & AUDIO")
  })

  it("provides structured columns and backward-compatible sections for all core departments", () => {
    const coreDepartments = [
      "phones-electronics",
      "fashion-apparel",
      "health-beauty",
      "food-groceries",
      "home-living",
      "baby-kids",
      "beverages",
      "pet-care",
      "agriculture",
      "automotive",
    ]

    for (const slug of coreDepartments) {
      const dept = MEGA_TAXONOMY[slug]
      expect(dept, `Missing department: ${slug}`).toBeDefined()
      expect(dept.columns.length).toBeGreaterThanOrEqual(3)
      expect(dept.sections.length).toBeGreaterThanOrEqual(3)
      for (const col of dept.columns) {
        expect(col.sections.length).toBeGreaterThan(0)
        for (const sec of col.sections) {
          expect(sec.title).toBeTruthy()
          expect(sec.items.length).toBeGreaterThan(0)
        }
      }
    }
  })
})
