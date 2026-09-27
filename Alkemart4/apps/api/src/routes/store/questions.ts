import { checkText } from "@alkemart/domain"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import type { QuestionRow } from "../../messages-store"
import { readJsonBody } from "../../lib/session"
import { requireFreshSession } from "../../middleware/auth"

/**
 * Public product Q&A. Anyone can read answered questions; signed-in buyers
 * ask a seller who sells the product. Unanswered questions stay private to
 * the asker and the seller, so the page never fills with silence.
 */
const AskBody = z.object({ productId: z.string().min(1), sellerId: z.string().min(1), question: z.string() })

export function publicQuestion(q: QuestionRow, sellerName: string | null) {
  return {
    id: q.id,
    productId: q.productId,
    sellerId: q.sellerId,
    sellerName,
    askerName: q.askerName ?? "A buyer",
    question: q.question,
    answer: q.answer,
    askedAt: q.createdAt.toISOString(),
    answeredAt: q.answeredAt?.toISOString() ?? null,
  }
}

export const storeQuestions = new Hono<AppEnv>()
  .get("/", async (c) => {
    const productId = c.req.query("productId")
    if (!productId) throw new HTTPException(400, { message: "productId required" })
    const rows = (await c.get("messages").listQuestions({ productId })).filter((q) => !!q.answer)
    const sellers = new Map((await c.get("authRepo").listSellers().catch(() => [])).map((s) => [s.id, s.name]))
    c.header("Cache-Control", "public, max-age=60")
    return c.json({ items: rows.map((q) => publicQuestion(q, sellers.get(q.sellerId) ?? null)) })
  })
  .post("/", requireFreshSession, async (c) => {
    const parsed = AskBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const problem = checkText("question", parsed.data.question)
    if (problem) throw new HTTPException(400, { message: problem })
    const product = await c.get("repo").getProduct(parsed.data.productId).catch(() => null)
    if (!product || !product.offers.some((o) => o.sellerId === parsed.data.sellerId)) {
      throw new HTTPException(404, { message: "That shop doesn't sell this product." })
    }
    const user = await c.get("authRepo").findUserById(c.get("auth").userId)
    if (!user) throw new HTTPException(401, { message: "Sign in to ask a question." })
    const q = await c.get("messages").addQuestion({
      productId: product.productId,
      sellerId: parsed.data.sellerId,
      askerUserId: user.id,
      askerName: user.firstName ?? null,
      question: parsed.data.question.trim(),
    })
    const seller = product.offers.find((o) => o.sellerId === q.sellerId)
    return c.json({ question: publicQuestion(q, seller?.sellerName ?? null) }, 201)
  })
