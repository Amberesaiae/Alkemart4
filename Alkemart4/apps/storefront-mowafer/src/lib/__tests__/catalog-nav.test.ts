import { describe, expect, it } from "vitest"
import { RAIL_DEPARTMENT_ORDER, capRailDepartments, resolveRailCategories } from "../catalog-nav"

describe("catalog-nav", () => {
  it("caps rail at 6", () => {
    const many = RAIL_DEPARTMENT_ORDER.concat(["pet-care", "other"] as never[])
    expect(capRailDepartments(many).length).toBeLessThanOrEqual(6)
  })

  it("keeps food last among core six", () => {
    expect(RAIL_DEPARTMENT_ORDER.at(-1)).toBe("food-groceries")
  })

  it("resolveRailCategories never exceeds the cap", () => {
    const api = [
      ...RAIL_DEPARTMENT_ORDER,
      "pet-care",
      "beverages",
      "agriculture",
    ].map((handle, i) => ({
      id: `id-${handle}`,
      name: handle,
      handle,
      rank: i,
      parentCategoryId: null,
    }))
    expect(resolveRailCategories(api).length).toBeLessThanOrEqual(6)
    expect(resolveRailCategories(api).map((c) => c.handle)).toEqual([...RAIL_DEPARTMENT_ORDER])
  })
})
