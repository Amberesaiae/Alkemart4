import { describe, it, expect, vi } from "vitest"
import { getBuyerAccess, getSessionCustomer } from "../auth"

vi.mock("../medusa", () => ({
  getMedusaClient: () => ({
    client: { getToken: vi.fn().mockResolvedValue(null) },
    store: { customer: { retrieve: vi.fn().mockResolvedValue({ customer: null }) } },
    auth: { login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) },
  }),
}))

describe("getBuyerAccess", () => {
  it("returns guest when not signed in", async () => {
    const result = await getBuyerAccess()
    expect(result).toBe("guest")
  })
})

describe("getSessionCustomer", () => {
  it("returns null when no token", async () => {
    const result = await getSessionCustomer()
    expect(result).toBeNull()
  })
})
