import { checkText } from "@alkemart/domain"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import type { MessageRow, ThreadRow } from "../../messages-store"
import { flagsOf, notifyNewMessage, publicMessage, publicThread, quickReplies } from "../../lib/messages"
import { readJsonBody } from "../../lib/session"
import { requireFreshSession } from "../../middleware/auth"

/**
 * Buyer side of messaging. Signed-in buyers only: a conversation needs a
 * name to answer to, and blocking/reporting must stick to an account.
 */
const StartBody = z.object({
  sellerId: z.string().min(1),
  productId: z.string().min(1).optional(),
  orderId: z.string().min(1).optional(),
  body: z.string(),
})
const SendBody = z.object({ body: z.string() })
const ReportBody = z.object({ reason: z.string().trim().min(3).max(300) })

async function me(c: Context<AppEnv>) {
  const user = await c.get("authRepo").findUserById(c.get("auth").userId)
  if (!user) throw new HTTPException(401, { message: "Sign in to send messages." })
  return user
}

async function myThread(c: Context<AppEnv>): Promise<ThreadRow> {
  const t = await c.get("messages").getThread(c.req.param("id") ?? "")
  if (!t || t.buyerUserId !== c.get("auth").userId) throw new HTTPException(404, { message: "conversation not found" })
  return t
}

function textOrThrow(kind: "message", body: string) {
  const problem = checkText(kind, body)
  if (problem) throw new HTTPException(400, { message: problem })
  return body.trim()
}

export const storeMessages = new Hono<AppEnv>()
  .use("*", requireFreshSession)
  .get("/", async (c) => {
    const store = c.get("messages")
    const threads = await store.listThreads({ buyerUserId: c.get("auth").userId })
    const sellers = new Map((await c.get("authRepo").listSellers().catch(() => [])).map((s) => [s.id, s.name]))
    const cards = await c.get("repo").productCardsByIds(threads.map((t) => t.productId).filter((x): x is string => !!x)).catch(() => new Map())
    const items = await Promise.all(
      threads.map(async (t) => {
        const last = (await store.listMessages(t.id)).at(-1) ?? null
        return publicThread(t, "buyer", { sellerName: sellers.get(t.sellerId) ?? null, productTitle: t.productId ? (cards.get(t.productId)?.title ?? null) : null, last })
      }),
    )
    return c.json({ items, unread: items.filter((i) => i.unread).length, quickReplies: quickReplies("buyer") })
  })
  /** Start (or continue) the conversation with a seller about a product or an order. */
  .post("/", async (c) => {
    const parsed = StartBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const body = textOrThrow("message", parsed.data.body)
    const user = await me(c)
    const seller = await c.get("authRepo").findSellerById(parsed.data.sellerId).catch(() => null)
    if (!seller || seller.status !== "open") throw new HTTPException(404, { message: "This shop isn't taking messages right now." })
    let orderId: string | null = null
    if (parsed.data.orderId) {
      // Only about your own order with this seller.
      const checkout = c.get("checkoutRepo")
      const order = await checkout.getOrder(parsed.data.orderId)
      const group = order ? await checkout.getOrderGroup(order.orderGroupId) : null
      if (!order || !group || order.sellerId !== seller.id || group.buyerEmail.toLowerCase() !== user.email.toLowerCase()) {
        throw new HTTPException(404, { message: "order not found" })
      }
      orderId = order.id
    }
    const store = c.get("messages")
    const t = await store.openThread({
      sellerId: seller.id,
      buyerUserId: user.id,
      buyerEmail: user.email,
      buyerName: user.firstName ?? null,
      productId: orderId ? null : (parsed.data.productId ?? null),
      orderId,
    })
    if (t.blockedBy) throw new HTTPException(409, { message: "This conversation is closed." })
    const m = await store.addMessage(t.id, "buyer", body, flagsOf(body))
    await notifyNewMessage(c, t, "buyer", body)
    return c.json({ thread: publicThread(t, "buyer", { sellerName: seller.name, last: m }), message: publicMessage(m) }, 201)
  })
  .get("/:id", async (c) => {
    const t = await myThread(c)
    const store = c.get("messages")
    const list = await store.listMessages(t.id)
    await store.markRead(t.id, "buyer", new Date())
    const seller = await c.get("authRepo").findSellerById(t.sellerId).catch(() => null)
    const card = t.productId ? (await c.get("repo").productCardsByIds([t.productId]).catch(() => new Map())).get(t.productId) : null
    return c.json({
      thread: publicThread(t, "buyer", { sellerName: seller?.name ?? null, productTitle: card?.title ?? null, last: list.at(-1) ?? null }),
      messages: list.map((m: MessageRow) => publicMessage(m)),
      quickReplies: quickReplies("buyer"),
    })
  })
  .post("/:id", async (c) => {
    const parsed = SendBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const body = textOrThrow("message", parsed.data.body)
    const t = await myThread(c)
    if (t.blockedBy) throw new HTTPException(409, { message: t.blockedBy === "buyer" ? "You blocked this shop. Unblock it to send a message." : "This conversation is closed." })
    const m = await c.get("messages").addMessage(t.id, "buyer", body, flagsOf(body))
    await notifyNewMessage(c, t, "buyer", body)
    return c.json({ message: publicMessage(m) }, 201)
  })
  .post("/:id/report", async (c) => {
    const parsed = ReportBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Say what happened in a few words." })
    const t = await myThread(c)
    await c.get("messages").report(t.id, "buyer", parsed.data.reason)
    return c.json({ ok: true })
  })
  .post("/:id/block", async (c) => {
    const t = await myThread(c)
    if (t.blockedBy && t.blockedBy !== "buyer") throw new HTTPException(409, { message: "This conversation is already closed." })
    await c.get("messages").setBlocked(t.id, "buyer")
    return c.json({ ok: true })
  })
  .post("/:id/unblock", async (c) => {
    const t = await myThread(c)
    if (t.blockedBy !== "buyer") throw new HTTPException(409, { message: "Only the one who blocked can unblock." })
    await c.get("messages").setBlocked(t.id, null)
    return c.json({ ok: true })
  })
