import { describe, it, expect } from "vitest"
import { hashPassword, verifyPassword, passwordHashNeedsUpgrade } from "../auth"

describe("password helpers", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("alkemart-test-1")
    expect(h).not.toContain("alkemart-test-1")
    expect(await verifyPassword("alkemart-test-1", h)).toBe(true)
    expect(await verifyPassword("wrong", h)).toBe(false)
  })
  it("supports an explicit higher work factor without losing old-hash compatibility", async () => {
    const old = await hashPassword("Local-only-test-pass")
    expect(passwordHashNeedsUpgrade(old, 600_000)).toBe(true)
    const upgraded = await hashPassword("Local-only-test-pass", 600_000)
    expect(await verifyPassword("Local-only-test-pass", upgraded)).toBe(true)
    expect(passwordHashNeedsUpgrade(upgraded, 600_000)).toBe(false)
  }, 30_000)
  it("rejects malformed or unbounded work factors before deriving", async () => {
    for (const hash of ["pbkdf2-sha256$999999999$00$00", "pbkdf2-sha256$100000$00$00", "garbage"]) {
      expect(await verifyPassword("test", hash)).toBe(false)
    }
  })
})
