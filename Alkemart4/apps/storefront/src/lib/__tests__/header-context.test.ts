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
    expect(headerSource.match(/aria-label="Search"/g)).toHaveLength(2)
    expect(headerSource).not.toMatch(/>\s*Search\s*</)
  })

  it("keeps location outside the primary commerce row", () => {
    const primaryStart = headerSource.indexOf("Primary commerce row")
    const contextStart = headerSource.indexOf("Mowafer-style taxonomy row")
    const picker = headerSource.indexOf("<DeliverToPicker", primaryStart)
    expect(primaryStart).toBeGreaterThan(-1)
    expect(contextStart).toBeGreaterThan(primaryStart)
    expect(picker).toBeGreaterThan(contextStart)
  })
})
