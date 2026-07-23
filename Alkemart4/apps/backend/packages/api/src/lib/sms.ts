/**
 * SMS adapter — Africa's Talking (primary) with log-only fallback.
 *
 * Best practices applied:
 *   - Direct HTTP to AT REST API (no npm dep, same pattern as email.ts)
 *   - Sandbox vs live toggled by AT_SANDBOX=true env var
 *   - Numbers normalised to E.164 before sending (AT requires +233…)
 *   - Never throws — returns Result so event subscribers stay safe
 *   - Bulk send in a single AT request (up to 1 000 recipients per call)
 *
 * Docs: https://developers.africastalking.com/docs/sms/sending
 *
 * Required env vars (set in Railway dashboard, never committed):
 *   AT_API_KEY      Africa's Talking API key
 *   AT_USERNAME     Africa's Talking username (usually your app name)
 *   AT_SENDER_ID    Alphanumeric sender name (optional; must be AT-registered)
 *   AT_SANDBOX=true Use AT sandbox (default false)
 */

import { logger } from "./logger"

const AT_LIVE    = "https://api.africastalking.com/version1/messaging"
const AT_SANDBOX = "https://api.sandbox.africastalking.com/version1/messaging"

export type SmsMessage = {
  /** E.164 or Ghana local (0XX…) — normalised before sending */
  to: string | string[]
  body: string
  /** Override AT_SENDER_ID for this message */
  senderId?: string
}

export type SendSmsResult =
  | { ok: true;  mode: "africastalking" | "log"; recipients: number }
  | { ok: false; error: string }

function configured(): "africastalking" | "log" {
  return process.env.AT_API_KEY?.trim() && process.env.AT_USERNAME?.trim()
    ? "africastalking"
    : "log"
}

export function isSmsDeliveryEnabled(): boolean {
  return configured() === "africastalking"
}

/**
 * Normalise a Ghana number to E.164 (+233XXXXXXXXX).
 * AT requires international format for Ghana routing.
 */
function toE164Ghana(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("233") && digits.length >= 12) return `+${digits}`
  if (digits.startsWith("0") && digits.length === 10)  return `+233${digits.slice(1)}`
  if (digits.length === 9) return `+233${digits}`
  // Already +233… or unknown format — pass through unchanged
  return raw.startsWith("+") ? raw : `+${digits}`
}

export async function sendSms(msg: SmsMessage): Promise<SendSmsResult> {
  const mode = configured()
  const recipients = Array.isArray(msg.to) ? msg.to : [msg.to]
  const normalised = recipients.map(toE164Ghana)

  if (mode === "log") {
    logger.info("sms.log_only", {
      to: normalised,
      preview: msg.body.slice(0, 120),
    })
    return { ok: true, mode: "log", recipients: normalised.length }
  }

  const endpoint = process.env.AT_SANDBOX === "true" ? AT_SANDBOX : AT_LIVE
  const senderId = (msg.senderId || process.env.AT_SENDER_ID || "").trim()

  const params = new URLSearchParams({
    username: process.env.AT_USERNAME!,
    to:       normalised.join(","),
    message:  msg.body,
  })
  if (senderId) params.set("from", senderId)

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apiKey:         process.env.AT_API_KEY!,
        Accept:         "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      logger.error("sms.at_http_error", { status: res.status, body: text })
      return { ok: false, error: `Africa's Talking HTTP ${res.status}` }
    }

    const json = (await res.json()) as {
      SMSMessageData?: {
        Recipients?: { statusCode: number; status: string; number: string }[]
      }
    }

    const sent = json.SMSMessageData?.Recipients?.filter(
      r => r.statusCode === 101,
    ).length ?? 0

    logger.info("sms.sent", { sent, total: normalised.length })
    return { ok: true, mode: "africastalking", recipients: sent }
  } catch (e) {
    const error = e instanceof Error ? e.message : "SMS send failed"
    logger.error("sms.send_error", { error })
    return { ok: false, error }
  }
}

// ---------------------------------------------------------------------------
// Templated message builders
// Keep messages short (≤160 chars = 1 SMS credit) to control cost.
// ---------------------------------------------------------------------------

export function orderConfirmedSms(opts: {
  buyerName: string
  orderId:   string
  total:     string // e.g. "GH₵ 45.00"
}): string {
  return `Alkemart: Hi ${opts.buyerName.split(" ")[0]}, your order #${opts.orderId.slice(-8).toUpperCase()} for ${opts.total} is confirmed. We'll notify you when it ships.`
}

export function orderShippedSms(opts: {
  buyerName: string
  orderId:   string
}): string {
  return `Alkemart: Your order #${opts.orderId.slice(-8).toUpperCase()} is on its way! The rider will contact you shortly.`
}

export function orderDeliveredSms(opts: {
  buyerName: string
  orderId:   string
}): string {
  return `Alkemart: Order #${opts.orderId.slice(-8).toUpperCase()} delivered! Rate your experience at alkemart.com/orders. Thank you.`
}

export function newOrderVendorSms(opts: {
  shopName: string
  orderId:  string
  items:    number
}): string {
  return `Alkemart: ${opts.shopName}, you have a new order! #${opts.orderId.slice(-8).toUpperCase()} (${opts.items} item${opts.items !== 1 ? "s" : ""}). Log in to pack & ship.`
}

export function sellerApprovedSms(opts: { shopName: string }): string {
  return `Alkemart: Great news! Your shop "${opts.shopName}" is approved. Log in to start listing at alkemart.com/seller`
}

export function productPublishedSms(opts: { title: string }): string {
  return `Alkemart: Your product "${opts.title.slice(0, 40)}" is live on alkemart.com`
}

export function productRejectedSms(opts: {
  title:   string
  message?: string | null
}): string {
  const note = opts.message ? ` Reason: ${opts.message.slice(0, 60)}` : ""
  return `Alkemart: "${opts.title.slice(0, 30)}" was not approved.${note} Edit and resubmit in your Seller Hub.`
}
