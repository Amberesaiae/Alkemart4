import { describe, expect, it } from "vitest"
import { decideListing, parseAiOpinion, type AiOpinion } from "../listing-review"
import type { ListingFinding } from "../listing-checks"

const block: ListingFinding = { code: "contact_details", severity: "block", field: "title", message: "Remove phone numbers" }
const approve: AiOpinion = { verdict: "approve", confidence: 0.95, reasons: [], model: "m" }

describe("listing review policy", () => {
  it("rule blocks go back to the seller in every mode, with the reason", () => {
    for (const mode of ["manual", "assist", "auto"] as const) {
      const o = decideListing({ mode, findings: [block], flags: [], ai: approve })
      expect(o.decision).toBe("request_changes")
      expect(o.reviewer).toBe("system")
      expect(o.reasons[0]!.code).toBe("contact_details")
    }
  })
  it("scam/counterfeit flags always reach a human, even with a confident AI", () => {
    const o = decideListing({ mode: "auto", findings: [], flags: [{ rule: "banned-words", message: "replica" }], ai: approve })
    expect(o.decision).toBe("escalate")
  })
  it("auto mode approves only clean, unflagged, confident listings", () => {
    expect(decideListing({ mode: "auto", findings: [], flags: [], ai: approve }).decision).toBe("approve")
    expect(decideListing({ mode: "auto", findings: [], flags: [], ai: { ...approve, confidence: 0.6 } }).decision).toBe("escalate")
    expect(decideListing({ mode: "auto", findings: [], flags: [{ rule: "price-outlier", message: "x" }], ai: approve }).decision).toBe("escalate")
  })
  it("manual and assist never auto-decide a clean listing", () => {
    expect(decideListing({ mode: "manual", findings: [], flags: [], ai: approve }).decision).toBe("escalate")
    expect(decideListing({ mode: "assist", findings: [], flags: [], ai: approve }).decision).toBe("escalate")
  })
  it("parses model output defensively", () => {
    expect(parseAiOpinion('ok {"verdict":"approve","confidence":0.9,"reasons":[]} done', "m")?.verdict).toBe("approve")
    expect(parseAiOpinion('{"verdict":"ship it"}', "m")).toBeNull()
    expect(parseAiOpinion("nonsense", "m")).toBeNull()
    expect(parseAiOpinion({ verdict: "changes", confidence: 7, reasons: [{ code: "Bad Photo!", message: "blurry" }] }, "m")).toEqual({
      verdict: "changes",
      confidence: 0,
      reasons: [{ code: "bad_photo_", message: "blurry" }],
      model: "m",
    })
  })
})
