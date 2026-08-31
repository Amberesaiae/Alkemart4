import { describe, expect, it } from "vitest"
import {
  InvalidModerationTransitionError,
  approveProduct,
  proposeProduct,
  rejectProduct,
  requestProductChanges,
} from "../moderation"

describe("proposeProduct", () => {
  it("moves draft and rejected to proposed", () => {
    expect(proposeProduct("draft")).toBe("proposed")
    expect(proposeProduct("rejected")).toBe("proposed")
  })

  it("is idempotent for proposed and allows published re-moderation", () => {
    expect(proposeProduct("proposed")).toBe("proposed")
    expect(proposeProduct("published")).toBe("proposed")
  })
})

describe("approveProduct / rejectProduct / requestProductChanges", () => {
  it("approves only from proposed", () => {
    expect(approveProduct("proposed")).toBe("published")
    expect(() => approveProduct("draft")).toThrow(InvalidModerationTransitionError)
    expect(() => approveProduct("published")).toThrow(InvalidModerationTransitionError)
  })

  it("rejects only from proposed", () => {
    expect(rejectProduct("proposed")).toBe("rejected")
    expect(() => rejectProduct("draft")).toThrow(InvalidModerationTransitionError)
  })

  it("request-changes keeps proposed and rejects other statuses", () => {
    expect(requestProductChanges("proposed")).toBe("proposed")
    expect(() => requestProductChanges("published")).toThrow(InvalidModerationTransitionError)
  })
})
