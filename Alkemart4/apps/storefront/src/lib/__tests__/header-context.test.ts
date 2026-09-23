import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  HEADER_CATEGORY_MAX,
  RAIL_DEPARTMENT_ORDER,
  resolveHeaderCategories,
  type NavCategory,
} from "@/lib/catalog-nav"

const headerSource = readFileSync(
  resolve(__dirname, "../../components/shell/AppHeader.tsx"),
  "utf8",
)

describe("global commerce header", () => {
  it("caps context navigation at six departments", () => {
    const categories: NavCategory[] = RAIL_DEPARTMENT_ORDER.slice(0, 12).map((handle, index) => ({
      id: `category-${index}`,
      name: `Category ${index}`,
      handle,
      rank: index,
      parentCategoryId: null,
    }))
    expect(HEADER_CATEGORY_MAX).toBe(6)
    expect(resolveHeaderCategories(categories)).toHaveLength(6)
  })

  it("uses icon-only search actions in desktop and mobile forms", () => {
    // Both search forms expose the filter sheet via an icon-only button;
    // there are no text-labeled "Search" submit buttons (submit is Enter).
    expect(headerSource.match(/aria-label="Open search filters"/g)).toHaveLength(2)
    expect(headerSource).not.toMatch(/>\s*Search\s*</)
  })

  it("renders location picker in the top primary commerce row matching the Hubtel reference", () => {
    expect(headerSource).toMatch(/<DeliverToPicker/)
  })

  it("renders hamburger category menu only on non-home pages and category rail only on home", () => {
    expect(headerSource).toMatch(/\{!isHome && <HeaderCategoryDropdown/)
    expect(headerSource).toMatch(/\{isHome && \(\s*<div[^>]*>\s*<HeaderCategoryNav/)
  })
})
