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
})
