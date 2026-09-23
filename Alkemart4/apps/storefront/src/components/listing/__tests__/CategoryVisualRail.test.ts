import { describe, expect, it } from "vitest"
import { resolveCategoryImage } from "../CategoryVisualRail"

describe("CategoryVisualRail", () => {
  it("resolves images for canonical category handles", () => {
    expect(resolveCategoryImage("phones-electronics")).toBe(
      "/images/categories/market-rail/electronics-v1.webp",
    )
    expect(resolveCategoryImage("fashion-apparel")).toBe(
      "/images/categories/market-rail/fashion-v1.webp",
    )
    expect(resolveCategoryImage("home-living")).toBe(
      "/images/categories/market-rail/home-v1.webp",
    )
    expect(resolveCategoryImage("health-beauty")).toBe(
      "/images/categories/market-rail/beauty-v1.webp",
    )
    expect(resolveCategoryImage("baby-kids")).toBe(
      "/images/categories/market-rail/baby-v1.webp",
    )
    expect(resolveCategoryImage("food-groceries")).toBe(
      "/images/categories/market-rail/groceries-v1.webp",
    )
  })

  it("resolves partial and alias slugs", () => {
    expect(resolveCategoryImage("electronics")).toBe(
      "/images/categories/market-rail/electronics-v1.webp",
    )
    expect(resolveCategoryImage("beauty")).toBe(
      "/images/categories/market-rail/beauty-v1.webp",
    )
    expect(resolveCategoryImage("groceries")).toBe(
      "/images/categories/market-rail/groceries-v1.webp",
    )
  })

  it("resolves dedicated L2 subcategory photography", () => {
    expect(resolveCategoryImage("phones")).toBe(
      "/images/products/demo/flagship-phone.jpg",
    )
    expect(resolveCategoryImage("kids")).toBe(
      "/images/products/demo/kids-cotton-tee.jpg",
    )
    expect(resolveCategoryImage("men")).toBe(
      "/images/products/demo/bomber-jacket.jpg",
    )
    expect(resolveCategoryImage("staples")).toBe(
      "/images/products/demo/jasmine-rice.jpg",
    )
  })

  it("returns null safely for unknown or empty handles", () => {
    expect(resolveCategoryImage(null)).toBeNull()
    expect(resolveCategoryImage(undefined)).toBeNull()
    expect(resolveCategoryImage("")).toBeNull()
    expect(resolveCategoryImage("unknown-random-category-xyz")).toBeNull()
  })
})
