import { describe, it, expect } from "vitest"
import { hashPassword, verifyPassword } from "../auth"

describe("password helpers", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("alkemart-test-1")
    expect(h).not.toContain("alkemart-test-1")
    expect(await verifyPassword("alkemart-test-1", h)).toBe(true)
    expect(await verifyPassword("wrong", h)).toBe(false)
  })
})
