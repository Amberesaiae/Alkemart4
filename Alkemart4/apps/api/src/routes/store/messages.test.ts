import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { signSessionJwt } from "../../lib/jwt"
import { InMemoryMessagesStore } from "../../messages-store"
import { resetRateLimits } from "../../middleware/security"

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"

async function world() {
  resetRateLimits()
  const snapshot = demoCatalog()
  const authRepo = new InMemoryAuthRepository()
  const messagesStore = new InMemoryMessagesStore()
  for (const [id, handle] of [["seller-a", "seller-a-msg"], ["seller-b", "seller-b-msg"]] as const) {
    await authRepo.registerVendor({ user: { id: `u-${id}`, email: `${id}@t.test`, passwordHash: await hashPassword("VendorPass1") }, seller: { id, handle, name: id === "seller-a" ? "Accra Mart" : "Kumasi Tech" } })
    await authRepo.updateSellerStatus(id, "open")
  }
  await authRepo.createUser({ id: "buyer-1", email: "ama@t.test", passwordHash: await hashPassword("BuyerPass1"), role: "buyer" })
  await authRepo.createUser({ id: "admin-1", email: "admin@t.test", passwordHash: await hashPassword("AdminPass1"), role: "admin" })
  const app = createApp({ repo: new InMemoryCatalogRepository(snapshot), checkoutRepo: new InMemoryCheckoutRepository(snapshot), authRepo, messagesStore, jwtSecret: JWT })
  const tok = {
    buyer: await signSessionJwt({ userId: "buyer-1", role: "buyer" }, JWT),
    seller: await signSessionJwt({ userId: "u-seller-a", role: "seller_member", sellerId: "seller-a" }, JWT),
    other: await signSessionJwt({ userId: "u-seller-b", role: "seller_member", sellerId: "seller-b" }, JWT),
    admin: await signSessionJwt({ userId: "admin-1", role: "admin" }, JWT),
  }
  const as = (who: keyof typeof tok | null) => async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, {
      method,
      headers: { ...(who ? { Authorization: `Bearer ${tok[who]}` } : {}), "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return { status: res.status, body: (await res.json()) as Record<string, any> }
  }
  return { buyer: as("buyer"), seller: as("seller"), other: as("other"), admin: as("admin"), anon: as(null), messagesStore }
}

describe("messages", () => {
  it("buyer asks about a product, seller replies; a phone number raises the pay-in-app warning", async () => {
    const w = await world()
    expect((await w.anon("POST", "/store/messages", { sellerId: "seller-a", body: "Is it available?" })).status).toBe(401)
    const started = await w.buyer("POST", "/store/messages", { sellerId: "seller-a", productId: "prod-tecno-spark", body: "Is it available?" })
    expect(started.status).toBe(201)
    const id = started.body.thread.id as string
    // The same subject reuses the thread.
    const again = await w.buyer("POST", "/store/messages", { sellerId: "seller-a", productId: "prod-tecno-spark", body: "Any colours?" })
    expect(again.body.thread.id).toBe(id)

    const inbox = await w.seller("GET", "/vendor/messages")
    expect(inbox.body.unread).toBe(1)
    expect(inbox.body.items[0]).toMatchObject({ productTitle: expect.any(String), buyerName: "Buyer", unread: true })
    expect(JSON.stringify(inbox.body)).not.toContain("ama@t.test")

    const reply = await w.seller("POST", `/vendor/messages/${id}`, { body: "Yes! Call me on 024 412 3456 and send momo" })
    expect(reply.body.message.warning).toMatch(/Pay only through alkemart/)
    const thread = await w.buyer("GET", `/store/messages/${id}`)
    expect(thread.body.messages.map((m: { sender: string }) => m.sender)).toEqual(["buyer", "buyer", "seller"])
    expect(thread.body.quickReplies).toContain("Is it available?")
    expect((await w.seller("GET", "/vendor/messages")).body.unread).toBe(0)
  })

  it("only the two sides can read; admin reads only reported threads and can close them", async () => {
    const w = await world()
    const id = (await w.buyer("POST", "/store/messages", { sellerId: "seller-a", body: "Hello" })).body.thread.id as string
    expect((await w.other("GET", `/vendor/messages/${id}`)).status).toBe(404)
    expect((await w.admin("GET", `/admin/messages/${id}`)).status).toBe(404)
    await w.seller("POST", `/vendor/messages/${id}/report`, { reason: "Asked me to pay outside the app" })
    expect((await w.admin("GET", "/admin/messages/reported")).body.items.map((t: { id: string }) => t.id)).toEqual([id])
    expect((await w.admin("GET", `/admin/messages/${id}`)).status).toBe(200)
    await w.admin("POST", `/admin/messages/${id}/resolve`, { action: "close" })
    expect((await w.buyer("POST", `/store/messages/${id}`, { body: "hello?" })).status).toBe(409)
    expect((await w.admin("GET", "/admin/messages/reported")).body.items).toEqual([])
  })

  it("blocking stops the other side; only the blocker can unblock", async () => {
    const w = await world()
    const id = (await w.buyer("POST", "/store/messages", { sellerId: "seller-a", body: "Hello" })).body.thread.id as string
    await w.seller("POST", `/vendor/messages/${id}/block`)
    expect((await w.buyer("POST", `/store/messages/${id}`, { body: "hello?" })).status).toBe(409)
    expect((await w.buyer("POST", `/store/messages/${id}/unblock`)).status).toBe(409)
    await w.seller("POST", `/vendor/messages/${id}/unblock`)
    expect((await w.buyer("POST", `/store/messages/${id}`, { body: "hello again" })).status).toBe(201)
  })

  it("shop page shows a reply time once there are enough conversations", async () => {
    const w = await world()
    for (const p of ["prod-tecno-spark", "p2", "p3"]) {
      const id = (await w.buyer("POST", "/store/messages", { sellerId: "seller-a", productId: p, body: "Available?" })).body.thread.id as string
      await w.seller("POST", `/vendor/messages/${id}`, { body: "Yes" })
    }
    const shop = await w.anon("GET", "/store/sellers/seller-a")
    expect(shop.body.seller.replyTime).toMatchObject({ label: "Usually replies within an hour" })
  })
})

describe("product questions", () => {
  it("ask → seller answers → public; unanswered stay private; admin can hide", async () => {
    const w = await world()
    expect((await w.buyer("POST", "/store/questions", { productId: "prod-tecno-spark", sellerId: "seller-a", question: "size?" })).status).toBe(400)
    expect((await w.buyer("POST", "/store/questions", { productId: "prod-tecno-spark", sellerId: "nobody", question: "Does it come with a charger?" })).status).toBe(404)
    const q = await w.buyer("POST", "/store/questions", { productId: "prod-tecno-spark", sellerId: "seller-a", question: "Does it come with a charger?" })
    expect(q.status).toBe(201)
    expect((await w.anon("GET", "/store/questions?productId=prod-tecno-spark")).body.items).toEqual([])
    const mine = await w.seller("GET", "/vendor/messages/questions")
    expect(mine.body.items[0]).toMatchObject({ question: "Does it come with a charger?", answer: null })
    await w.seller("POST", `/vendor/messages/questions/${q.body.question.id}/answer`, { answer: "Yes, a 18W charger." })
    const pub = await w.anon("GET", "/store/questions?productId=prod-tecno-spark")
    expect(pub.body.items[0]).toMatchObject({ answer: "Yes, a 18W charger.", sellerName: "Accra Mart" })
    await w.admin("POST", `/admin/messages/questions/${q.body.question.id}/hide`)
    expect((await w.anon("GET", "/store/questions?productId=prod-tecno-spark")).body.items).toEqual([])
  })
})
