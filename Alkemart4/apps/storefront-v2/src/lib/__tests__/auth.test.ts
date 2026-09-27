import { beforeEach, describe, expect, it } from "vitest"
import { getBuyerAccess, getSessionCustomer, getWorkersAccessToken, logout } from "../auth"

describe("buyer session", () => {
  beforeEach(() => localStorage.clear())

  it("is a guest with no stored session", async () => {
    expect(await getBuyerAccess()).toBe("guest")
    expect(await getSessionCustomer()).toBeNull()
  })

  it("reads a stored Workers session as a customer", async () => {
    localStorage.setItem(
      "alkemart_session",
      JSON.stringify({ token: "t1", user: { id: "u1", email: "a@b.co", role: "buyer" } }),
    )
    expect(await getBuyerAccess()).toBe("customer")
    expect((await getSessionCustomer())?.email).toBe("a@b.co")
    expect(getWorkersAccessToken()).toBe("t1")
    await logout()
    expect(await getSessionCustomer()).toBeNull()
  })
})
