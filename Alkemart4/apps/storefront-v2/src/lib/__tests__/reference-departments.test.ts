// @vitest-environment node
import { describe, expect, it } from "vitest"
import { REFERENCE_DEPARTMENTS, referenceDepartmentHref } from "@/components/home/reference-departments"

describe("desktop reference departments", () => {
  it("keeps the reference order and distinct live taglines", () => {
    expect(REFERENCE_DEPARTMENTS.map(d => d.id)).toEqual(["electronics", "fashion", "home", "beauty", "gaming", "appliances"])
    expect(new Set(REFERENCE_DEPARTMENTS.map(d => d.tagline)).size).toBe(6)
  })

  it("uses the real category handle when present", () => {
    expect(referenceDepartmentHref("electronics", [{ id: "cat-1", handle: "phones-electronics", name: "Phones & Electronics" }])).toBe("/categories/phones-electronics")
  })

  it("uses search when a department has no real category", () => {
    expect(referenceDepartmentHref("gaming", [])).toBe("/search?q=gaming")
    expect(referenceDepartmentHref("appliances", [])).toBe("/search?q=appliances")
  })
})
