import {
  isEditableStatus,
  isLiveStatus,
  isUnpublishableStatus,
  normalizeStatus,
  PRODUCT_EDITABLE_STATUSES,
} from "../product-lifecycle.ts"

describe("product lifecycle status rules", () => {
  it("declares the editable (pre-live) statuses", () => {
    expect(PRODUCT_EDITABLE_STATUSES).toEqual(
      new Set(["draft", "proposed", "rejected"]),
    )
  })

  it("considers draft, proposed, rejected editable", () => {
    expect(isEditableStatus("draft")).toBe(true)
    expect(isEditableStatus("proposed")).toBe(true)
    expect(isEditableStatus("rejected")).toBe(true)
  })

  it("is case-insensitive and trims noise", () => {
    expect(isEditableStatus("Proposed")).toBe(true)
    expect(isEditableStatus(" DRAFT ")).toBe(false) // only lowercased value matters; whitespace is not in set
  })

  it("forbids editing live / unknown statuses", () => {
    expect(isEditableStatus("published")).toBe(false)
    expect(isEditableStatus(undefined)).toBe(false)
    expect(isEditableStatus(null)).toBe(false)
    expect(isEditableStatus("")).toBe(false)
    expect(isEditableStatus("archived")).toBe(false)
  })

  it("marks only published as unpublishable (takes down for edit)", () => {
    expect(isUnpublishableStatus("published")).toBe(true)
    expect(isUnpublishableStatus("Published")).toBe(true)
    expect(isUnpublishableStatus("draft")).toBe(false)
    expect(isUnpublishableStatus("proposed")).toBe(false)
    expect(isUnpublishableStatus("rejected")).toBe(false)
  })

  it("exposes isLiveStatus for parity checks (admin/vendor)", () => {
    expect(isLiveStatus("published")).toBe(true)
    expect(isLiveStatus("draft")).toBe(false)
  })

  it("normalizeStatus is a pure lowercaser", () => {
    expect(normalizeStatus("Proposed")).toBe("proposed")
    expect(normalizeStatus(undefined)).toBe("")
    expect(normalizeStatus(42)).toBe("42")
  })
})
