/**
 * Messaging glue (pilot phase 4): who may read a thread, how it's shown,
 * the payment warning, reply time, and the outbox emails.
 */
import {
  QUICK_REPLIES,
  REPLY_TIME_MIN_SAMPLES,
  contactFlags,
  medianReplyMinutes,
  needsPaymentWarning,
  replyTimeLabel,
} from "@alkemart/domain"
import { orderReference } from "@alkemart/shared/order-ref"
import type { Context } from "hono"
import type { AppEnv } from "../context"
import { encodeEmail } from "../email"
import type { MessageRow, MessagesStore, Side, ThreadRow } from "../messages-store"
import { returnUpdateEmail } from "./email-templates"
import { orderEmailLinks } from "./order-emails"

/** The line both sides see when a message looks like a deal outside the app. */
export const PAYMENT_WARNING =
  "Pay only through alkemart. Payments made outside the app aren't protected, and alkemart will never ask you to send money to a number."

export function publicMessage(m: MessageRow) {
  return { id: m.id, sender: m.sender, body: m.body, at: m.createdAt.toISOString(), warning: needsPaymentWarning(m.flags) ? PAYMENT_WARNING : null }
}

export type ThreadExtras = { sellerName?: string | null; productTitle?: string | null; last?: MessageRow | null }

export function publicThread(t: ThreadRow, viewer: Side | "admin", extras: ThreadExtras = {}) {
  const readAt = viewer === "buyer" ? t.buyerReadAt : viewer === "seller" ? t.sellerReadAt : null
  const other: Side = viewer === "buyer" ? "seller" : "buyer"
  const last = extras.last ?? null
  return {
    id: t.id,
    sellerId: t.sellerId,
    sellerName: extras.sellerName ?? null,
    // Sellers see a first name at most; never the buyer's email.
    buyerName: t.buyerName ?? "Buyer",
    productId: t.productId,
    productTitle: extras.productTitle ?? null,
    orderId: t.orderId,
    orderReference: t.orderId ? orderReference(t.orderId) : null,
    last: last ? { body: last.body.slice(0, 140), sender: last.sender, at: last.createdAt.toISOString() } : null,
    unread: viewer !== "admin" && !!last && last.sender === other && (!readAt || readAt < last.createdAt),
    blocked: !!t.blockedBy,
    blockedByYou: viewer !== "admin" && t.blockedBy === viewer,
    reported: !!t.reportedAt && !t.reportResolvedAt,
    ...(viewer === "admin" ? { reportedBy: t.reportedBy, reportReason: t.reportReason, reportedAt: t.reportedAt?.toISOString() ?? null } : {}),
    lastMessageAt: t.lastMessageAt.toISOString(),
  }
}

export const quickReplies = (side: Side) => QUICK_REPLIES[side]

export function flagsOf(body: string) {
  return contactFlags(body)
}

/** Seller's usual reply time over the last 30 days, or null when too few messages to say. */
export async function sellerReplyTime(store: MessagesStore, sellerId: string, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 24 * 3_600_000)
  const msgs = await store.sellerMessagesSince(sellerId, since).catch((): (MessageRow & { threadId: string })[] => [])
  // Each buyer message that opens a turn, paired with the seller's next reply in that thread.
  const byThread = new Map<string, MessageRow[]>()
  for (const m of msgs) byThread.set(m.threadId, [...(byThread.get(m.threadId) ?? []), m])
  const pairs: { askedAt: Date; repliedAt: Date | null }[] = []
  for (const list of byThread.values()) {
    let asked: Date | null = null
    for (const m of list) {
      if (m.sender === "buyer" && !asked) asked = m.createdAt
      if (m.sender === "seller" && asked) {
        pairs.push({ askedAt: asked, repliedAt: m.createdAt })
        asked = null
      }
    }
    if (asked) pairs.push({ askedAt: asked, repliedAt: null })
  }
  if (pairs.length < REPLY_TIME_MIN_SAMPLES) return null
  const minutes = medianReplyMinutes(pairs, now)
  return { minutes, label: replyTimeLabel(minutes) }
}

/** One email per thread per hour to the other side, so a chat doesn't flood an inbox. */
export async function notifyNewMessage(c: Context<AppEnv>, t: ThreadRow, from: Side, body: string, now = new Date()) {
  try {
    const links = orderEmailLinks(c)
    const hour = Math.floor(now.getTime() / 3_600_000)
    const to = from === "buyer" ? await links.sellerEmail?.(t.sellerId).catch(() => null) : t.buyerEmail
    const base = from === "buyer" ? links.vendorUrl : links.storefrontUrl
    if (!to || !base) return
    const shop = from === "seller" ? ((await links.sellerName?.(t.sellerId).catch(() => null)) ?? "The seller") : null
    await c.get("checkoutRepo").enqueueNotification({
      key: `message:${t.id}:${from}:${hour}`,
      recipient: to,
      channel: "email",
      category: "transactional",
      body: encodeEmail(
        returnUpdateEmail({
          heading: from === "buyer" ? "A buyer sent you a message" : `${shop} replied to you`,
          paragraphs: [`“${body.slice(0, 300)}”`, "Reply in alkemart — keep payments in the app so you're protected."],
          url: `${base}/messages/${t.id}`,
          cta: "Open the conversation",
        }),
      ),
    })
  } catch {
    /* messages never fail on email */
  }
}
