import { describe, expect, it } from "vitest"
import { checkText, contactFlags, medianReplyMinutes, needsPaymentWarning, replyTimeLabel } from "../messaging"

describe("contactFlags", () => {
  it("catches Ghana numbers written many ways", () => {
    for (const t of ["call 0244123456", "024 412 3456", "+233 24 412 3456", "233-24-412-3456", "0 2 4 4 1 2 3 4 5 6"]) expect(contactFlags(t).phone, t).toBe(true)
  })
  it("ignores prices, order numbers and short numbers", () => {
    for (const t of ["GH₵1,850.00", "order #EB1855", "it costs 250", "2 pieces left", "model 2024"]) expect(needsPaymentWarning(contactFlags(t)), t).toBe(false)
  })
  it("catches emails and talk of paying outside", () => {
    expect(contactFlags("mail me at ama@gmail.com").email).toBe(true)
    expect(contactFlags("just send momo to me").payOutside).toBe(true)
    expect(contactFlags("chat me on whatsapp").payOutside).toBe(true)
  })
})

describe("text rules", () => {
  it("explains what's wrong in plain words", () => {
    expect(checkText("message", "  ")).toMatch(/Write a message/)
    expect(checkText("question", "size?")).toMatch(/full question/)
    expect(checkText("question", "Does it come with a charger?")).toBeNull()
    expect(checkText("answer", "Yes")).toBeNull()
  })
})

describe("reply time", () => {
  const t = (m: number) => new Date(Date.UTC(2026, 8, 1, 10, m))
  it("is the median, and an ignored buyer counts as waiting", () => {
    const now = new Date(Date.UTC(2026, 8, 1, 20, 0))
    expect(medianReplyMinutes([{ askedAt: t(0), repliedAt: t(10) }, { askedAt: t(0), repliedAt: t(30) }, { askedAt: t(0), repliedAt: null }], now)).toBe(30)
    expect(medianReplyMinutes([], now)).toBeNull()
  })
  it("labels in shop-page words", () => {
    expect(replyTimeLabel(20)).toBe("Usually replies within an hour")
    expect(replyTimeLabel(180)).toBe("Usually replies within a few hours")
    expect(replyTimeLabel(2000)).toBe("Usually replies in more than a day")
    expect(replyTimeLabel(null)).toBeNull()
  })
})
