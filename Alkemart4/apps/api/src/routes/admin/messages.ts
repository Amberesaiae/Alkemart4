import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { publicMessage, publicThread } from "../../lib/messages"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"
import { publicQuestion } from "../store/questions"

/**
 * Admin reads **only reported** conversations — private messages stay
 * private otherwise. Resolving a report either dismisses it or closes the
 * conversation for good. Product questions can be hidden. All audit-logged.
 */
const ResolveBody = z.object({ action: z.enum(["dismiss", "close"]), note: z.string().trim().max(300).optional() })

export const adminMessages = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/reported", async (c) => {
    const store = c.get("messages")
    const threads = await store.listThreads({ reported: true })
    const sellers = new Map((await c.get("authRepo").listSellers().catch(() => [])).map((s) => [s.id, s.name]))
    const cards = await c.get("repo").productCardsByIds(threads.map((t) => t.productId).filter((x): x is string => !!x)).catch(() => new Map())
    const items = await Promise.all(
      threads.map(async (t) =>
        publicThread(t, "admin", {
          sellerName: sellers.get(t.sellerId) ?? null,
          productTitle: t.productId ? (cards.get(t.productId)?.title ?? null) : null,
          last: (await store.listMessages(t.id)).at(-1) ?? null,
        }),
      ),
    )
    return c.json({ items })
  })
  .get("/questions", async (c) => {
    const rows = (await c.get("messages").listQuestions({ includeHidden: true })).slice(0, 100)
    const sellers = new Map((await c.get("authRepo").listSellers().catch(() => [])).map((s) => [s.id, s.name]))
    return c.json({ items: rows.map((q) => ({ ...publicQuestion(q, sellers.get(q.sellerId) ?? null), hidden: q.hidden })) })
  })
  .post("/questions/:qid/:action{hide|show}", async (c) => {
    const hidden = c.req.param("action") === "hide"
    const q = await c.get("messages").setQuestionHidden(c.req.param("qid"), hidden)
    if (!q) throw new HTTPException(404, { message: "question not found" })
    await c.get("auditLog").log({ adminUserId: c.get("auth").userId, action: hidden ? "questions.hide" : "questions.show", targetType: "product_question", targetId: q.id, detail: { productId: q.productId } })
    return c.json({ ok: true })
  })
  .get("/:id", async (c) => {
    const store = c.get("messages")
    const t = await store.getThread(c.req.param("id"))
    // Not reported → not admin's to read.
    if (!t || !t.reportedAt) throw new HTTPException(404, { message: "conversation not found" })
    const seller = await c.get("authRepo").findSellerById(t.sellerId).catch(() => null)
    const list = await store.listMessages(t.id)
    await c.get("auditLog").log({ adminUserId: c.get("auth").userId, action: "messages.read_reported", targetType: "message_thread", targetId: t.id, detail: {} })
    return c.json({ thread: publicThread(t, "admin", { sellerName: seller?.name ?? null, last: list.at(-1) ?? null }), messages: list.map(publicMessage) })
  })
  .post("/:id/resolve", async (c) => {
    const parsed = ResolveBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const store = c.get("messages")
    const t = await store.getThread(c.req.param("id"))
    if (!t || !t.reportedAt) throw new HTTPException(404, { message: "conversation not found" })
    if (parsed.data.action === "close") await store.setBlocked(t.id, "admin")
    await store.resolveReport(t.id)
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: `messages.report_${parsed.data.action}`,
      targetType: "message_thread",
      targetId: t.id,
      detail: { reason: t.reportReason, note: parsed.data.note ?? null },
    })
    return c.json({ ok: true })
  })
