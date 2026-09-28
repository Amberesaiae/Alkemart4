import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../auth-repository"
import { createApp } from "../index"
import { signSessionJwt } from "../lib/jwt"

const secret = "vendor-permissions-test-secret-at-least-32"
async function setup(role: "owner" | "staff", status: "open" | "suspended" = "open") {
  const repo = new InMemoryAuthRepository()
  await repo.registerVendor({ user: { id: "vendor", email: "vendor@example.com", passwordHash: "!test" }, seller: { id: "shop", name: "Shop", handle: "shop" } })
  await repo.markEmailVerified("vendor")
  await repo.updateSellerStatus("shop", status)
  const find = repo.findSellerMemberByUserId.bind(repo)
  repo.findSellerMemberByUserId = async (id) => { const member = await find(id); return member ? { ...member, role } : null }
  const app = createApp({ authRepo: repo, jwtSecret: secret })
  const token = await signSessionJwt({ userId: "vendor", role: "seller_member", sellerId: "shop" }, secret)
  const call = (path: string, method = "POST", body: unknown = {}) => app.request(path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) })
  return { call }
}
describe("pilot vendor permissions", () => {
  it.each([
    ["/vendor/sellers/me", "POST"],
    ["/vendor/sellers/me", "GET"],
    ["/vendor/sellers/me/address", "POST"],
    ["/vendor/sellers/me/policies", "POST"],
    ["/vendor/sellers/me/payment-details", "POST"],
    ["/vendor/returns/case/refund", "POST"],
    ["/vendor/returns/case/refund-paid", "POST"],
    ["/vendor/onboarding/ghana-setup", "POST"],
    ["/vendor/payouts", "GET"],
    ["/vendor/business", "GET"],
  ])("denies staff %s %s before side effects", async (path, method) => {
    const { call } = await setup("staff")
    expect((await call(path, method)).status).toBe(403)
  })
  it("lets owners update their own shop", async () => {
    const { call } = await setup("owner")
    expect((await call("/vendor/sellers/me", "POST", { name: "Updated shop" })).status).toBe(200)
  })
  it("still blocks suspended owners", async () => {
    const { call } = await setup("owner", "suspended")
    expect((await call("/vendor/sellers/me", "POST", { name: "Updated shop" })).status).toBe(403)
  })
})
