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

  it("keeps delivery area visible in the primary commerce row", () => {
    // Redesign decision (bc9fe17): compact DeliverToPicker lives in the
    // primary row so delivery eligibility is visible before any product
    // decision; the taxonomy row below carries browse context only.
    const primaryStart = headerSource.indexOf("Primary commerce row")
    const contextStart = headerSource.indexOf(
      "Full-width, horizontally scrollable taxonomy row.",
    )
    const picker = headerSource.indexOf("<DeliverToPicker", primaryStart)
    expect(primaryStart).toBeGreaterThan(-1)
    expect(contextStart).toBeGreaterThan(primaryStart)
    expect(picker).toBeGreaterThan(primaryStart)
    expect(picker).toBeLessThan(contextStart)
    expect(headerSource.match(/<DeliverToPicker/g)).toHaveLength(1)
  })
})
