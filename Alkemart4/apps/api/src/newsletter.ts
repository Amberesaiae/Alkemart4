import { newsletterSubscribers } from "@alkemart/db"
import { eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type NewsletterStatus = "pending" | "confirmed" | "unsubscribed"

/** Double opt-in list. Emails are stored lower-cased and trimmed. */
export interface NewsletterStore {
  /** New → pending; already pending/confirmed → unchanged; unsubscribed → pending again (they asked). Returns the status after. */
  subscribe(email: string, source: string | null): Promise<NewsletterStatus>
  confirm(email: string): Promise<boolean>
  unsubscribe(email: string): Promise<boolean>
  status(email: string): Promise<NewsletterStatus | null>
}

export class InMemoryNewsletterStore implements NewsletterStore {
  private rows = new Map<string, { status: NewsletterStatus; source: string | null }>()
  async subscribe(email: string, source: string | null) {
    const cur = this.rows.get(email)
    if (!cur || cur.status === "unsubscribed") {
      this.rows.set(email, { status: "pending", source })
      return "pending" as const
    }
    return cur.status
  }
  async confirm(email: string) {
    const cur = this.rows.get(email)
    if (!cur || cur.status === "unsubscribed") return false
    cur.status = "confirmed"
    return true
  }
  async unsubscribe(email: string) {
    const cur = this.rows.get(email)
    if (!cur) return false
    cur.status = "unsubscribed"
    return true
  }
  async status(email: string) {
    return this.rows.get(email)?.status ?? null
  }
}

export class PostgresNewsletterStore implements NewsletterStore {
  constructor(private readonly db: PostgresJsDatabase) {}
  async subscribe(email: string, source: string | null) {
    const [row] = await this.db
      .insert(newsletterSubscribers)
      .values({ email, source, status: "pending" })
      .onConflictDoUpdate({
        target: newsletterSubscribers.email,
        // Only an unsubscribed person re-subscribing goes back to pending.
        set: { status: sql`CASE WHEN ${newsletterSubscribers.status} = 'unsubscribed' THEN 'pending' ELSE ${newsletterSubscribers.status} END` },
      })
      .returning({ status: newsletterSubscribers.status })
    return (row?.status ?? "pending") as NewsletterStatus
  }
  async confirm(email: string) {
    const rows = await this.db
      .update(newsletterSubscribers)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(sql`${newsletterSubscribers.email} = ${email} AND ${newsletterSubscribers.status} <> 'unsubscribed'`)
      .returning({ email: newsletterSubscribers.email })
    return rows.length > 0
  }
  async unsubscribe(email: string) {
    const rows = await this.db
      .update(newsletterSubscribers)
      .set({ status: "unsubscribed", unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribers.email, email))
      .returning({ email: newsletterSubscribers.email })
    return rows.length > 0
  }
  async status(email: string) {
    const [row] = await this.db.select({ status: newsletterSubscribers.status }).from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email)).limit(1)
    return (row?.status as NewsletterStatus | undefined) ?? null
  }
}
