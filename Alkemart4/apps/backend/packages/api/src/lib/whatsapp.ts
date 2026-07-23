/**
 * WhatsApp Business API adapter — Meta Cloud API (direct).
 *
 * Why Meta Cloud API over Africa's Talking WhatsApp:
 *   - Free tier: 1 000 business-initiated conversations/month
 *   - Direct integration, no additional gateway cost
 *   - Webhooks for delivery receipts
 *   - Template messages required for outbound (business-initiated)
 *
 * Best practices applied:
 *   - Template messages only for transactional notifications (WA policy)
 *   - Phone numbers normalised to E.164 before sending
 *   - Never throws — subscribers stay safe
 *   - Log-only fallback when env vars absent
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 *
 * Required env vars (Railway dashboard):
 *   WA_PHONE_NUMBER_ID   WhatsApp Cloud API phone number ID
 *   WA_ACCESS_TOKEN      System user access token (permanent)
 *   WA_TEMPLATE_LANG     BCP-47 language code (default: en_US)
 *
 * Template names must be pre-approved in Meta Business Manager.
 * Register templates at: business.facebook.com → WhatsApp → Message Templates
 */

import { logger } from "./logger"

const META_API_BASE = "https://graph.facebook.com/v20.0"

export type WaTemplateMessage = {
  /** E.164 recipient phone (+233…) */
  to:           string
  templateName: string
  /** Ordered body parameter values matching the template placeholders */
  bodyParams?:  string[]
  /** Header image URL (for media templates) */
  headerImageUrl?: string
}

export type SendWaResult =
  | { ok: true;  mode: "whatsapp" | "log"; messageId?: string }
  | { ok: false; error: string }

function configured(): "whatsapp" | "log" {
  return process.env.WA_PHONE_NUMBER_ID?.trim() &&
    process.env.WA_ACCESS_TOKEN?.trim()
    ? "whatsapp"
    : "log"
}

export function isWhatsAppEnabled(): boolean {
  return configured() === "whatsapp"
}

function toE164Ghana(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("233") && digits.length >= 12) return `+${digits}`
  if (digits.startsWith("0") && digits.length === 10)  return `+233${digits.slice(1)}`
  if (digits.length === 9) return `+233${digits}`
  return raw.startsWith("+") ? raw : `+${digits}`
}

export async function sendWhatsAppTemplate(
  msg: WaTemplateMessage,
): Promise<SendWaResult> {
  const mode = configured()
  const to   = toE164Ghana(msg.to).replace(/^\+/, "") // Meta expects no leading +

  if (mode === "log") {
    logger.info("whatsapp.log_only", {
      to: `+${to}`,
      template: msg.templateName,
      params: msg.bodyParams,
    })
    return { ok: true, mode: "log" }
  }

  const lang = process.env.WA_TEMPLATE_LANG || "en_US"

  const bodyComponents: unknown[] = []
  if (msg.bodyParams?.length) {
    bodyComponents.push({
      type:       "body",
      parameters: msg.bodyParams.map(text => ({ type: "text", text })),
    })
  }
  if (msg.headerImageUrl) {
    bodyComponents.unshift({
      type:       "header",
      parameters: [{ type: "image", image: { link: msg.headerImageUrl } }],
    })
  }

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name:       msg.templateName,
      language:   { code: lang },
      components: bodyComponents.length ? bodyComponents : undefined,
    },
  }

  try {
    const res = await fetch(
      `${META_API_BASE}/${process.env.WA_PHONE_NUMBER_ID}/messages`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    )

    const json = (await res.json().catch(() => null)) as {
      messages?: { id: string }[]
      error?:    { message: string; code: number }
    } | null

    if (!res.ok || json?.error) {
      const err = json?.error?.message || `Meta API HTTP ${res.status}`
      logger.error("whatsapp.meta_error", { to, template: msg.templateName, err })
      return { ok: false, error: err }
    }

    const messageId = json?.messages?.[0]?.id
    logger.info("whatsapp.sent", { to: `+${to}`, template: msg.templateName, messageId })
    return { ok: true, mode: "whatsapp", messageId }
  } catch (e) {
    const error = e instanceof Error ? e.message : "WhatsApp send failed"
    logger.error("whatsapp.send_error", { error })
    return { ok: false, error }
  }
}

// ---------------------------------------------------------------------------
// Template message builders
// Template names must match what you register in Meta Business Manager.
// These names are by convention; rename to match your approved templates.
// ---------------------------------------------------------------------------

/** alkemart_order_confirmed — body: {{1}}=buyer name, {{2}}=order ID, {{3}}=total */
export function waOrderConfirmed(opts: {
  buyerPhone: string
  buyerName:  string
  orderId:    string
  total:      string
}): WaTemplateMessage {
  return {
    to:           opts.buyerPhone,
    templateName: "alkemart_order_confirmed",
    bodyParams:   [opts.buyerName.split(" ")[0], `#${opts.orderId.slice(-8).toUpperCase()}`, opts.total],
  }
}

/** alkemart_order_shipped — body: {{1}}=order ID */
export function waOrderShipped(opts: {
  buyerPhone: string
  orderId:    string
}): WaTemplateMessage {
  return {
    to:           opts.buyerPhone,
    templateName: "alkemart_order_shipped",
    bodyParams:   [`#${opts.orderId.slice(-8).toUpperCase()}`],
  }
}

/** alkemart_new_order_vendor — body: {{1}}=shop name, {{2}}=order ID, {{3}}=item count */
export function waNewOrderVendor(opts: {
  vendorPhone: string
  shopName:    string
  orderId:     string
  items:       number
}): WaTemplateMessage {
  return {
    to:           opts.vendorPhone,
    templateName: "alkemart_new_order_vendor",
    bodyParams:   [opts.shopName, `#${opts.orderId.slice(-8).toUpperCase()}`, String(opts.items)],
  }
}

/** alkemart_seller_approved — body: {{1}}=shop name */
export function waSellerApproved(opts: {
  vendorPhone: string
  shopName:    string
}): WaTemplateMessage {
  return {
    to:           opts.vendorPhone,
    templateName: "alkemart_seller_approved",
    bodyParams:   [opts.shopName],
  }
}
