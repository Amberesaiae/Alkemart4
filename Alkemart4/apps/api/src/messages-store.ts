import { messageThreads, messages, productQuestions } from "@alkemart/db"
import type { ContactFlags } from "@alkemart/domain"
import { and, asc, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type Side = "buyer" | "seller"

export type ThreadRow = {
  id: string
  sellerId: string
  buyerUserId: string
  buyerEmail: string
  buyerName: string | null
  subject: string
  productId: string | null
  orderId: string | null
  buyerReadAt: Date | null
  sellerReadAt: Date | null
  blockedBy: "buyer" | "seller" | "admin" | null
  reportedBy: Side | null
  reportReason: string | null
  reportedAt: Date | null
  reportResolvedAt: Date | null
  lastMessageAt: Date
  createdAt: Date
}

export type MessageRow = { id: string; threadId: string; sender: Side; body: string; flags: ContactFlags; createdAt: Date }

export type QuestionRow = {
  id: string
  productId: string
  sellerId: string
  askerUserId: string
  askerName: string | null
  question: string
  answer: string | null
  answeredAt: Date | null
  hidden: boolean
  createdAt: Date
}

export type NewThread = {
  sellerId: string
  buyerUserId: string
  buyerEmail: string
  buyerName: string | null
  productId: string | null
  orderId: string | null
}

/** `product:<id>`, `order:<id>` or `general` — one thread per buyer, seller and subject. */
export const threadSubject = (t: { productId: string | null; orderId: string | null }) =>
  t.orderId ? `order:${t.orderId}` : t.productId ? `product:${t.productId}` : "general"

/**
 * Buyer ↔ seller messages and product Q&A (0045). Reading a thread is
 * limited to its two sides in the routes; admin only reads reported threads.
 */
export interface MessagesStore {
  openThread(input: NewThread): Promise<ThreadRow>
  getThread(id: string): Promise<ThreadRow | null>
  listThreads(filter: { buyerUserId?: string; sellerId?: string; reported?: boolean }): Promise<ThreadRow[]>
  listMessages(threadId: string): Promise<MessageRow[]>
  /** Appends and bumps the thread; the sender has read up to now. */
  addMessage(threadId: string, sender: Side, body: string, flags: ContactFlags): Promise<MessageRow>
  markRead(threadId: string, side: Side, at: Date): Promise<void>
  setBlocked(threadId: string, by: ThreadRow["blockedBy"]): Promise<ThreadRow | null>
  report(threadId: string, by: Side, reason: string): Promise<ThreadRow | null>
  resolveReport(threadId: string): Promise<ThreadRow | null>
  /** Messages for a seller's reply-time stat (both sides), since a date. */
  sellerMessagesSince(sellerId: string, since: Date): Promise<(MessageRow & { threadId: string })[]>
  addQuestion(q: Omit<QuestionRow, "id" | "answer" | "answeredAt" | "hidden" | "createdAt">): Promise<QuestionRow>
  getQuestion(id: string): Promise<QuestionRow | null>
  listQuestions(filter: { productId?: string; sellerId?: string; unansweredOnly?: boolean; includeHidden?: boolean }): Promise<QuestionRow[]>
  answerQuestion(id: string, sellerId: string, answer: string): Promise<QuestionRow | null>
  setQuestionHidden(id: string, hidden: boolean): Promise<QuestionRow | null>
}

export class InMemoryMessagesStore implements MessagesStore {
  private threads = new Map<string, ThreadRow>()
  private msgs: MessageRow[] = []
  private questions = new Map<string, QuestionRow>()
  /** Test/sandbox clock. */
  now: () => Date = () => new Date()

  async openThread(input: NewThread) {
    const subject = threadSubject(input)
    const hit = [...this.threads.values()].find((t) => t.sellerId === input.sellerId && t.buyerUserId === input.buyerUserId && t.subject === subject)
    if (hit) return { ...hit }
    const now = this.now()
    const row: ThreadRow = {
      id: crypto.randomUUID(),
      ...input,
      subject,
      buyerReadAt: null,
      sellerReadAt: null,
      blockedBy: null,
      reportedBy: null,
      reportReason: null,
      reportedAt: null,
      reportResolvedAt: null,
      lastMessageAt: now,
      createdAt: now,
    }
    this.threads.set(row.id, row)
    return { ...row }
  }
  async getThread(id: string) {
    const t = this.threads.get(id)
    return t ? { ...t } : null
  }
  async listThreads(f: { buyerUserId?: string; sellerId?: string; reported?: boolean }) {
    return [...this.threads.values()]
      .filter((t) => (!f.buyerUserId || t.buyerUserId === f.buyerUserId) && (!f.sellerId || t.sellerId === f.sellerId))
      .filter((t) => !f.reported || (!!t.reportedAt && !t.reportResolvedAt))
      .sort((a, b) => +b.lastMessageAt - +a.lastMessageAt)
      .map((t) => ({ ...t }))
  }
  async listMessages(threadId: string) {
    return this.msgs.filter((m) => m.threadId === threadId).map((m) => ({ ...m }))
  }
  async addMessage(threadId: string, sender: Side, body: string, flags: ContactFlags) {
    const t = this.threads.get(threadId)
    if (!t) throw new Error("thread not found")
    const at = new Date(Math.max(this.now().getTime(), (this.msgs.at(-1)?.createdAt.getTime() ?? 0) + 1))
    const m: MessageRow = { id: crypto.randomUUID(), threadId, sender, body, flags, createdAt: at }
    this.msgs.push(m)
    t.lastMessageAt = at
    if (sender === "buyer") t.buyerReadAt = at
    else t.sellerReadAt = at
    return { ...m }
  }
  async markRead(threadId: string, side: Side, at: Date) {
    const t = this.threads.get(threadId)
    if (!t) return
    if (side === "buyer") t.buyerReadAt = at
    else t.sellerReadAt = at
  }
  async setBlocked(threadId: string, by: ThreadRow["blockedBy"]) {
    const t = this.threads.get(threadId)
    if (!t) return null
    t.blockedBy = by
    return { ...t }
  }
  async report(threadId: string, by: Side, reason: string) {
    const t = this.threads.get(threadId)
    if (!t) return null
    Object.assign(t, { reportedBy: by, reportReason: reason, reportedAt: this.now(), reportResolvedAt: null })
    return { ...t }
  }
  async resolveReport(threadId: string) {
    const t = this.threads.get(threadId)
    if (!t) return null
    t.reportResolvedAt = this.now()
    return { ...t }
  }
  async sellerMessagesSince(sellerId: string, since: Date) {
    const ids = new Set([...this.threads.values()].filter((t) => t.sellerId === sellerId).map((t) => t.id))
    return this.msgs.filter((m) => ids.has(m.threadId) && m.createdAt >= since).map((m) => ({ ...m }))
  }
  async addQuestion(q: Omit<QuestionRow, "id" | "answer" | "answeredAt" | "hidden" | "createdAt">) {
    const row: QuestionRow = { ...q, id: crypto.randomUUID(), answer: null, answeredAt: null, hidden: false, createdAt: this.now() }
    this.questions.set(row.id, row)
    return { ...row }
  }
  async getQuestion(id: string) {
    const q = this.questions.get(id)
    return q ? { ...q } : null
  }
  async listQuestions(f: { productId?: string; sellerId?: string; unansweredOnly?: boolean; includeHidden?: boolean }) {
    return [...this.questions.values()]
      .filter((q) => (!f.productId || q.productId === f.productId) && (!f.sellerId || q.sellerId === f.sellerId))
      .filter((q) => (!f.unansweredOnly || !q.answer) && (f.includeHidden || !q.hidden))
      .sort((a, b) => +b.createdAt - +a.createdAt)
      .map((q) => ({ ...q }))
  }
  async answerQuestion(id: string, sellerId: string, answer: string) {
    const q = this.questions.get(id)
    if (!q || q.sellerId !== sellerId) return null
    q.answer = answer
    q.answeredAt = this.now()
    return { ...q }
  }
  async setQuestionHidden(id: string, hidden: boolean) {
    const q = this.questions.get(id)
    if (!q) return null
    q.hidden = hidden
    return { ...q }
  }
}

const toThread = (r: typeof messageThreads.$inferSelect): ThreadRow => ({ ...r, blockedBy: r.blockedBy ?? null, reportedBy: r.reportedBy ?? null })
const toMessage = (r: typeof messages.$inferSelect): MessageRow => ({ ...r })

export class PostgresMessagesStore implements MessagesStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async openThread(input: NewThread) {
    const subject = threadSubject(input)
    await this.db
      .insert(messageThreads)
      .values({ id: crypto.randomUUID(), ...input, subject })
      .onConflictDoNothing({ target: [messageThreads.sellerId, messageThreads.buyerUserId, messageThreads.subject] })
    const [row] = await this.db
      .select()
      .from(messageThreads)
      .where(and(eq(messageThreads.sellerId, input.sellerId), eq(messageThreads.buyerUserId, input.buyerUserId), eq(messageThreads.subject, subject)))
      .limit(1)
    if (!row) throw new Error("thread not opened")
    return toThread(row)
  }
  async getThread(id: string) {
    const [r] = await this.db.select().from(messageThreads).where(eq(messageThreads.id, id)).limit(1)
    return r ? toThread(r) : null
  }
  async listThreads(f: { buyerUserId?: string; sellerId?: string; reported?: boolean }) {
    const where = [
      f.buyerUserId ? eq(messageThreads.buyerUserId, f.buyerUserId) : undefined,
      f.sellerId ? eq(messageThreads.sellerId, f.sellerId) : undefined,
      f.reported ? and(isNotNull(messageThreads.reportedAt), isNull(messageThreads.reportResolvedAt)) : undefined,
    ].filter(Boolean)
    const rows = await this.db
      .select()
      .from(messageThreads)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(messageThreads.lastMessageAt))
      .limit(200)
    return rows.map(toThread)
  }
  async listMessages(threadId: string) {
    const rows = await this.db.select().from(messages).where(eq(messages.threadId, threadId)).orderBy(asc(messages.createdAt)).limit(500)
    return rows.map(toMessage)
  }
  async addMessage(threadId: string, sender: Side, body: string, flags: ContactFlags) {
    return this.db.transaction(async (tx) => {
      const now = new Date()
      const [m] = await tx.insert(messages).values({ id: crypto.randomUUID(), threadId, sender, body, flags, createdAt: now }).returning()
      await tx
        .update(messageThreads)
        .set({ lastMessageAt: now, ...(sender === "buyer" ? { buyerReadAt: now } : { sellerReadAt: now }) })
        .where(eq(messageThreads.id, threadId))
      if (!m) throw new Error("message not saved")
      return toMessage(m)
    })
  }
  async markRead(threadId: string, side: Side, at: Date) {
    await this.db
      .update(messageThreads)
      .set(side === "buyer" ? { buyerReadAt: at } : { sellerReadAt: at })
      .where(eq(messageThreads.id, threadId))
  }
  async setBlocked(threadId: string, by: ThreadRow["blockedBy"]) {
    const [r] = await this.db.update(messageThreads).set({ blockedBy: by }).where(eq(messageThreads.id, threadId)).returning()
    return r ? toThread(r) : null
  }
  async report(threadId: string, by: Side, reason: string) {
    const [r] = await this.db
      .update(messageThreads)
      .set({ reportedBy: by, reportReason: reason, reportedAt: new Date(), reportResolvedAt: null })
      .where(eq(messageThreads.id, threadId))
      .returning()
    return r ? toThread(r) : null
  }
  async resolveReport(threadId: string) {
    const [r] = await this.db.update(messageThreads).set({ reportResolvedAt: new Date() }).where(eq(messageThreads.id, threadId)).returning()
    return r ? toThread(r) : null
  }
  async sellerMessagesSince(sellerId: string, since: Date) {
    const rows = await this.db
      .select({ m: messages })
      .from(messages)
      .innerJoin(messageThreads, eq(messageThreads.id, messages.threadId))
      .where(and(eq(messageThreads.sellerId, sellerId), gte(messages.createdAt, since)))
      .orderBy(asc(messages.createdAt))
      .limit(2000)
    return rows.map((r) => toMessage(r.m))
  }
  async addQuestion(q: Omit<QuestionRow, "id" | "answer" | "answeredAt" | "hidden" | "createdAt">) {
    const [r] = await this.db.insert(productQuestions).values({ id: crypto.randomUUID(), ...q }).returning()
    if (!r) throw new Error("question not saved")
    return r
  }
  async getQuestion(id: string) {
    const [r] = await this.db.select().from(productQuestions).where(eq(productQuestions.id, id)).limit(1)
    return r ?? null
  }
  async listQuestions(f: { productId?: string; sellerId?: string; unansweredOnly?: boolean; includeHidden?: boolean }) {
    const where = [
      f.productId ? eq(productQuestions.productId, f.productId) : undefined,
      f.sellerId ? eq(productQuestions.sellerId, f.sellerId) : undefined,
      f.unansweredOnly ? isNull(productQuestions.answer) : undefined,
      f.includeHidden ? undefined : eq(productQuestions.hidden, false),
    ].filter(Boolean)
    return this.db
      .select()
      .from(productQuestions)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(productQuestions.createdAt))
      .limit(200)
  }
  async answerQuestion(id: string, sellerId: string, answer: string) {
    const [r] = await this.db
      .update(productQuestions)
      .set({ answer, answeredAt: sql`now()` })
      .where(and(eq(productQuestions.id, id), eq(productQuestions.sellerId, sellerId)))
      .returning()
    return r ?? null
  }
  async setQuestionHidden(id: string, hidden: boolean) {
    const [r] = await this.db.update(productQuestions).set({ hidden }).where(eq(productQuestions.id, id)).returning()
    return r ?? null
  }
}
