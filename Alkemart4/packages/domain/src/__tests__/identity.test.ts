import { describe, expect, it } from "vitest"
import {
  assertAssignableCategory,
  deprecateCategory,
  resolveCategoryRedirect,
  TaxonomyTransitionError,
} from "../taxonomy"
import {
  AttributeValidationError,
  canShowComparison,
  IdentityTransitionError,
  promoteIdentityConfidence,
  validateAttributeValue,
} from "../identity"

describe("taxonomy lifecycle (Phase 1A)", () => {
  it("deprecates only active nodes with an active replacement", () => {
    expect(() =>
      deprecateCategory({ id: "a", status: "active" }, { id: "b", status: "active" }),
    ).not.toThrow()
    expect(() =>
      deprecateCategory({ id: "a", status: "active" }, null),
    ).toThrow(TaxonomyTransitionError)
    expect(() =>
      deprecateCategory({ id: "a", status: "deprecated" }, { id: "b", status: "active" }),
    ).toThrow(TaxonomyTransitionError)
    expect(() =>
      deprecateCategory({ id: "a", status: "active" }, { id: "a", status: "active" }),
    ).toThrow(/itself/)
    expect(() =>
      deprecateCategory({ id: "a", status: "active" }, { id: "b", status: "proposed" }),
    ).toThrow(/replacement must be an active/)
  })

  it("follows redirect chains and rejects cycles", () => {
    const byId = new Map([
      ["old", { id: "old", status: "deprecated" as const, replacementNodeId: "mid" }],
      ["mid", { id: "mid", status: "deprecated" as const, replacementNodeId: "new" }],
      ["new", { id: "new", status: "active" as const, replacementNodeId: null }],
    ])
    expect(resolveCategoryRedirect("old", byId)).toBe("new")
    expect(resolveCategoryRedirect("new", byId)).toBe("new")
    const cyclic = new Map([
      ["x", { id: "x", status: "deprecated" as const, replacementNodeId: "y" }],
      ["y", { id: "y", status: "deprecated" as const, replacementNodeId: "x" }],
    ])
    expect(() => resolveCategoryRedirect("x", cyclic)).toThrow(/cycle/)
  })

  it("restricts publishing to active assignable nodes", () => {
    expect(() =>
      assertAssignableCategory({ id: "p", status: "active", isAssignable: true }),
    ).not.toThrow()
    expect(() =>
      assertAssignableCategory({ id: "g", status: "active", isAssignable: false }),
    ).toThrow(/assignable/)
    expect(() =>
      assertAssignableCategory({ id: "d", status: "deprecated", isAssignable: true }),
    ).toThrow(/assignable/)
  })
})

describe("identity confidence (ADR-002)", () => {
  it("promotes only with a reviewer, never demotes silently", () => {
    expect(
      promoteIdentityConfidence("seller_specific", "matched", "admin-1"),
    ).toBe("matched")
    expect(() =>
      promoteIdentityConfidence("seller_specific", "matched", null),
    ).toThrow(IdentityTransitionError)
    expect(() =>
      promoteIdentityConfidence("matched", "seller_specific", "admin-1"),
    ).toThrow(/demoted/)
  })

  it("gates comparison on identified/matched", () => {
    expect(canShowComparison("identified")).toBe(true)
    expect(canShowComparison("matched")).toBe(true)
    expect(canShowComparison("seller_specific")).toBe(false)
  })
})

describe("typed attribute values (Phase 1C)", () => {
  it("enforces one slot matching the definition type", () => {
    expect(() =>
      validateAttributeValue(
        { id: "d1", code: "storage", type: "number", required: true },
        { numberValue: 128, unit: "GB" },
      ),
    ).not.toThrow()
    expect(() =>
      validateAttributeValue(
        { id: "d1", code: "storage", type: "number", required: true },
        { textValue: "128GB" },
      ),
    ).toThrow(AttributeValidationError)
    expect(() =>
      validateAttributeValue(
        { id: "d2", code: "network", type: "option", allowedValues: ["4G", "5G"], required: false },
        { optionValues: ["5G"] },
      ),
    ).not.toThrow()
    expect(() =>
      validateAttributeValue(
        { id: "d2", code: "network", type: "option", allowedValues: ["4G", "5G"], required: false },
        { optionValues: ["6G"] },
      ),
    ).toThrow(/not allowed/)
    expect(() =>
      validateAttributeValue(
        { id: "d2", code: "network", type: "option", allowedValues: ["4G", "5G"], required: false },
        { optionValues: ["4G", "5G"] },
      ),
    ).toThrow(/single option/)
  })
})
