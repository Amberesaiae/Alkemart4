import { describe, expect, it } from "vitest"
import {
  DEPARTMENT_THEMES,
  departmentTheme,
  passesContrast,
} from "@alkemart/shared"
import { governedTheme } from "../category-theme"

describe("governed department themes (Phase 1E)", () => {
  it("covers the 13 launch departments", () => {
    expect(DEPARTMENT_THEMES).toHaveLength(13)
  })

  it("every accent/ink pair passes WCAG AA", () => {
    for (const t of DEPARTMENT_THEMES) {
      expect(passesContrast(t), t.departmentId).toBe(true)
    }
  })

  it("resolves known departments, null otherwise", () => {
    expect(departmentTheme("fashion")?.accent).toBeTruthy()
    expect(departmentTheme("nope")).toBeNull()
    expect(governedTheme("fashion")?.accentInk).toBe("#FFFFFF")
    expect(governedTheme("nope")).toBeNull()
  })

  it("resolves canonical catalog handle aliases", () => {
    expect(departmentTheme("food-groceries")?.accent).toBe("#166534")
    expect(departmentTheme("phones-electronics")?.accent).toBe("#0E7C86")
    expect(departmentTheme("fashion-apparel")?.accent).toBe("#6D28D9")
    expect(departmentTheme("home-living")?.accent).toBe("#B42318")
    expect(departmentTheme("health-beauty")?.accent).toBe("#A21CAF")
  })
})
