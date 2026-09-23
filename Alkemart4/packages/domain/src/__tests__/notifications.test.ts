import { describe, expect, it } from "vitest"
import {
  checkSendPermission,
  withinFrequencyCap,
  type PreferenceRow,
} from "../notifications"

const pref = (over: Partial<PreferenceRow> & { category: string }): PreferenceRow => ({
  channel: "sms",
  topic: null,
  optedIn: true,
  frequencyCap: null,
  ...over,
})

describe("checkSendPermission (Phase 7A)", () => {
  it("always allows transactional service messages", () => {
    expect(
      checkSendPermission([], { channel: "sms", category: "transactional" }).allowed,
    ).toBe(true)
    expect(
      checkSendPermission([pref({ category: "transactional", optedIn: false })], {
        channel: "sms",
        category: "transactional",
      }).allowed,
    ).toBe(true)
  })
  it("denies promotional sends without explicit opt-in", () => {
    expect(checkSendPermission([], { channel: "sms", category: "promotional" })).toMatchObject({
      allowed: false,
    })
    expect(
      checkSendPermission([pref({ category: "promotional", optedIn: false })], {
        channel: "sms",
        category: "promotional",
      }).allowed,
    ).toBe(false)
    expect(
      checkSendPermission([pref({ category: "promotional", optedIn: true })], {
        channel: "sms",
        category: "promotional",
      }).allowed,
    ).toBe(true)
  })
  it("allows operational by default, honors opt-outs and topics", () => {
    expect(
      checkSendPermission([], { channel: "sms", category: "operational" }).allowed,
    ).toBe(true)
    const out = checkSendPermission(
      [pref({ category: "operational", topic: "stock", optedIn: false })],
      { channel: "sms", category: "operational", topic: "stock" },
    )
    expect(out.allowed).toBe(false)
    // An unrelated topic stays allowed.
    expect(
      checkSendPermission(
        [pref({ category: "operational", topic: "stock", optedIn: false })],
        { channel: "sms", category: "operational", topic: "sla" },
      ).allowed,
    ).toBe(true)
    // A whole-category opt-in covers every topic.
    expect(
      checkSendPermission(
        [pref({ category: "promotional", topic: null, optedIn: true })],
        { channel: "sms", category: "promotional", topic: "price-drop" },
      ).allowed,
    ).toBe(true)
  })
})

describe("withinFrequencyCap (Phase 7A)", () => {
  const now = new Date("2026-09-21T12:00:00.000Z")
  it("passes unlimited caps and blocks exhausted ones", () => {
    expect(withinFrequencyCap([], null, now)).toBe(true)
    expect(withinFrequencyCap([now], 1, now)).toBe(false)
    expect(withinFrequencyCap([now], 2, now)).toBe(true)
    expect(
      withinFrequencyCap([new Date("2026-09-19T12:00:00.000Z")], 1, now),
    ).toBe(true)
    expect(withinFrequencyCap([], 0, now)).toBe(false)
  })
})
