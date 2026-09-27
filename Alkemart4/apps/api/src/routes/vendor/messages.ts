import { checkText } from "@alkemart/domain"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import type { ThreadRow } from "../../messages-store"
import { flagsOf, notifyNewMessage, publicMessage, publicThread, quickReplies, sellerReplyTime } from "../../lib/messages"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"
import { publicQuestion } from "../store/questions"

/** The seller's inbox: buyer conversations and product questions. */
const SendBody = z.object({ body: z.string() })
const ReportBody = z.object({ reason: z.string().trim().min(3).max(300) })
const AnswerBody = z.object({ answer: z.string() })

function sellerOf(c: Context<AppEnv>) {
  const id = c.get("auth").sellerId
  if (!id) throw new HTTPException(403, { message: "forbidden" })
  return id
}

async function myThread(c: Context<AppEnv>): Promise<ThreadRow> {
  const t = await c.get("messages").getThread(c.req.param("id") ?? "")
  if (!t || t.sellerId !== sellerOf(c)) throw new HTTPException(404, { message: "conversation not found" })
  return t
}

export const vendorMessages = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/", async (c) => {
    const sellerId = sellerOf(c)
    const store = c.get("messages")
    const threads = await store.listThreads({ sellerId })
    const cards = await c.get("repo").productCardsByIds(threads.map((t) => t.productId).filter((x): x is string => !!x)).catch(() => new Map())
    const items = await Promise.all(
      threads.map(async (t) => {
        const last = (await store.listMessages(t.id)).at(-1) ?? null
        return publicThread(t, "seller", { productTitle: t.productId ? (cards.get(t.productId)?.title ?? null) : null, last })
      }),
    )
    const unanswered = (await store.listQuestions({ sellerId, unansweredOnly: true })).length
    return c.json({ items, unread: items.filter((i) => i.unread).length, unansweredQuestions: unanswered, replyTime: await sellerReplyTime(store, sellerId) })
  })
  .get("/questions", async (c) => {
    const sellerId = sellerOf(c)
    const rows = await c.get("messages").listQuestions({ sellerId })
    const cards = await c.get("repo").productCardsByIds([...new Set(rows.map((q) => q.productId))]).catch(() => new Map())
    // Unanswered first, newest first within each.
    const items = rows
      .sort((a, b) => Number(!!a.answer) - Number(!!b.answer) || +b.createdAt - +a.createdAt)
      .map((q) => ({ ...publicQuestion(q, null), productTitle: cards.get(q.productId)?.title ?? null, hidden: q.hidden }))
    return c.json({ items })
  })
  .post("/questions/:qid/answer", async (c) => {
    const parsed = AnswerBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const problem = checkText("answer", parsed.data.answer)
    if (problem) throw new HTTPException(400, { message: problem })
    const q = await c.get("messages").answerQuestion(c.req.param("qid"), sellerOf(c), parsed.data.answer.trim())
    if (!q) throw new HTTPException(404, { message: "question not found" })
    return c.json({ question: publicQuestion(q, null) })
  })
  .get("/:id", async (c) => {
    const t = await myThread(c)
    const store = c.get("messages")
    const list = await store.listMessages(t.id)
    await store.markRead(t.id, "seller", new Date())
    const card = t.productId ? (await c.get("repo").productCardsByIds([t.productId]).catch(() => new Map())).get(t.productId) : null
    return c.json({
      thread: publicThread(t, "seller", { productTitle: card?.title ?? null, last: list.at(-1) ?? null }),
      messages: list.map(publicMessage),
      quickReplies: quickReplies("seller"),
    })
  })
  .post("/:id", async (c) => {
    const parsed = SendBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const problem = checkText("message", parsed.data.body)
    if (problem) throw new HTTPException(400, { message: problem })
    const t = await myThread(c)
    if (t.blockedBy) throw new HTTPException(409, { message: t.blockedBy === "seller" ? "You blocked this buyer. Unblock them to reply." : "This conversation is closed." })
    const body = parsed.data.body.trim()
    const m = await c.get("messages").addMessage(t.id, "seller", body, flagsOf(body))
    await notifyNewMessage(c, t, "seller", body)
    return c.json({ message: publicMessage(m) }, 201)
  })
  .post("/:id/report", async (c) => {
    const parsed = ReportBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Say what happened in a few words." })
    const t = await myThread(c)
    await c.get("messages").report(t.id, "seller", parsed.data.reason)
    return c.json({ ok: true })
  })
  .post("/:id/block", async (c) => {
    const t = await myThread(c)
    if (t.blockedBy && t.blockedBy !== "seller") throw new HTTPException(409, { message: "This conversation is already closed." })
    await c.get("messages").setBlocked(t.id, "seller")
    return c.json({ ok: true })
  })
  .post("/:id/unblock", async (c) => {
    const t = await myThread(c)
    if (t.blockedBy !== "seller") throw new HTTPException(409, { message: "Only the one who blocked can unblock." })
    await c.get("messages").setBlocked(t.id, null)
    return c.json({ ok: true })
  })
