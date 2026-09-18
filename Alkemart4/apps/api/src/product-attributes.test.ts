import { describe, expect, it } from "vitest"
import { attributesFromJson, parseProductAttributes } from "@alkemart/shared/product-attributes"

describe("product attributes", () => {
  it("normalises labels so weight, Wt. and WEIGHT collapse", () => {
    const parsed = parseProductAttributes([
      { label: "  WEIGHT ", value: "  1ltr " },
    ])
    expect(parsed).toEqual({ ok: true, attributes: [{ label: "Weight", value: "1ltr" }] })
  })

  it("rejects a duplicate fact", () => {
    const parsed = parseProductAttributes([
      { label: "Volume", value: "1ltr" },
      { label: "volume", value: "500ml" },
    ])
    expect(parsed.ok).toBe(false)
  })

  it("treats empty rows as omitted, not as errors", () => {
    const parsed = parseProductAttributes([
      { label: "", value: "" },
      { label: "Pack", value: "1 bottle" },
    ])
    expect(parsed).toEqual({ ok: true, attributes: [{ label: "Pack", value: "1 bottle" }] })
  })

  it("reads stored JSON and drops malformed rows", () => {
    expect(attributesFromJson([{ label: "Volume", value: "1ltr" }, { label: 1 }])).toEqual([])
    expect(attributesFromJson([{ label: "Volume", value: "1ltr" }])).toEqual([{ label: "Volume", value: "1ltr" }])
  })
})
