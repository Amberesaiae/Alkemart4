/**
 * Messaging and product Q&A (pilot phase 4). Rules live here; the API
 * applies them and the apps only display.
 *
 * Messages are never blocked for containing a phone number — people share
 * them for delivery — but a number, an email or talk of paying outside the
 * app raises a "pay only through alkemart" warning to both sides, and the
 * thread can be reported. Admin reads only reported threads.
 */

export const MESSAGE_MAX = 2000
export const QUESTION_MIN = 8
export const QUESTION_MAX = 500
export const ANSWER_MAX = 1000

/** One-tap starters. The API sends these; apps don't repeat them. */
export const QUICK_REPLIES = {
  buyer: ["Is it available?", "Can you deliver today?", "Can I pick it up?", "Is the price negotiable?"],
  seller: ["Yes, it's available.", "Sorry, it's sold out.", "I can deliver today.", "You can pick it up from the shop."],
} as const

export type ContactFlags = { phone: boolean; email: boolean; payOutside: boolean }

// Ghana mobile/landline: 0XX XXX XXXX, or +233 / 233 then 9 digits; spaces, dots or dashes between.
const PHONE = /(?:\+?233|\b0)[\s.-]*[2-5](?:[\s.-]*\d){8}\b/
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PAY_OUTSIDE = /\b(momo|mobile money|send (?:the )?money|pay (?:me )?direct(?:ly)?|whats\s?app|outside (?:the )?app|bank transfer|my number)\b/i

/** What in a message should trigger the "pay only through alkemart" warning. */
export function contactFlags(text: string): ContactFlags {
  return { phone: PHONE.test(text), email: EMAIL.test(text), payOutside: PAY_OUTSIDE.test(text) }
}

export function needsPaymentWarning(f: ContactFlags): boolean {
  return f.phone || f.email || f.payOutside
}

/** Plain-language check for a message, question or answer. Returns a problem or null. */
export function checkText(kind: "message" | "question" | "answer", raw: string): string | null {
  const t = raw.trim()
  if (kind === "message") return t.length === 0 ? "Write a message first." : t.length > MESSAGE_MAX ? `Keep it under ${MESSAGE_MAX} characters.` : null
  if (kind === "question") {
    if (t.length < QUESTION_MIN) return "Ask a full question, e.g. “Does it come with a charger?”"
    return t.length > QUESTION_MAX ? `Keep it under ${QUESTION_MAX} characters.` : null
  }
  if (t.length < 2) return "Write an answer first."
  return t.length > ANSWER_MAX ? `Keep it under ${ANSWER_MAX} characters.` : null
}

/**
 * Median minutes between a buyer's message and the seller's next reply,
 * from `(askedAt, repliedAt)` pairs. Unanswered pairs count as the time
 * waited so far (capped), so ignoring buyers doesn't flatter a shop.
 */
export function medianReplyMinutes(pairs: { askedAt: Date; repliedAt: Date | null }[], now: Date, capMinutes = 72 * 60): number | null {
  if (pairs.length === 0) return null
  const mins = pairs
    .map((p) => Math.min(capMinutes, Math.max(0, ((p.repliedAt ?? now).getTime() - p.askedAt.getTime()) / 60_000)))
    .sort((a, b) => a - b)
  const mid = Math.floor(mins.length / 2)
  return Math.round(mins.length % 2 ? mins[mid]! : (mins[mid - 1]! + mins[mid]!) / 2)
}

/** Fewer than this many buyer messages and we don't show a reply time. */
export const REPLY_TIME_MIN_SAMPLES = 3

/** "Usually replies within an hour" — shop-page wording. */
export function replyTimeLabel(minutes: number | null): string | null {
  if (minutes === null) return null
  if (minutes <= 60) return "Usually replies within an hour"
  if (minutes <= 4 * 60) return "Usually replies within a few hours"
  if (minutes <= 24 * 60) return "Usually replies within a day"
  return "Usually replies in more than a day"
}
