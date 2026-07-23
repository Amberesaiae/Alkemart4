/**
 * Thin email adapter (v1). Logs when SMTP/API keys unset — test-friendly.
 * Production: set EMAIL_FROM + (SMTP_* or RESEND_API_KEY).
 */

import { logger } from "./logger"

export type EmailMessage = {
  to: string
  subject: string
  text: string
  html?: string
  tags?: string[]
}

export type SendEmailResult =
  | { ok: true; mode: "smtp" | "resend" | "log" }
  | { ok: false; error: string }

function configured(): "resend" | "smtp" | "log" {
  if (process.env.RESEND_API_KEY?.trim()) return "resend"
  if (
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim()
  ) {
    return "smtp"
  }
  return "log"
}

export function isEmailDeliveryEnabled(): boolean {
  return configured() !== "log" || process.env.EMAIL_LOG_ONLY === "true"
}

export async function sendEmail(msg: EmailMessage): Promise<SendEmailResult> {
  const from =
    process.env.EMAIL_FROM?.trim() || "alkemart <noreply@alkemart.local>"
  const mode = configured()

  if (!msg.to?.includes("@")) {
    return { ok: false, error: "Invalid recipient" }
  }

  if (mode === "log") {
    logger.info("email.log_only", {
      to: msg.to,
      subject: msg.subject,
      tags: msg.tags,
      preview: msg.text.slice(0, 200),
    })
    return { ok: true, mode: "log" }
  }

  if (mode === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [msg.to],
          subject: msg.subject,
          text: msg.text,
          html: msg.html || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        logger.error("email.resend_failed", { status: res.status, body })
        return { ok: false, error: `Resend ${res.status}` }
      }
      return { ok: true, mode: "resend" }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Resend failed",
      }
    }
  }

  // SMTP via undici/fetch is not standard — use dynamic import of nodemailer if present
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require("nodemailer") as {
      createTransport: (opts: unknown) => {
        sendMail: (opts: unknown) => Promise<unknown>
      }
    }
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
    await transport.sendMail({
      from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    })
    return { ok: true, mode: "smtp" }
  } catch (e) {
    logger.warn("email.smtp_unavailable", {
      error: e instanceof Error ? e.message : String(e),
    })
    // Fallback to log so subscribers never crash the event bus
    logger.info("email.log_fallback", {
      to: msg.to,
      subject: msg.subject,
    })
    return { ok: true, mode: "log" }
  }
}

export function sellerLifecycleEmail(opts: {
  to: string
  shopName: string
  event: string
  reason?: string | null
}): EmailMessage {
  const subjectMap: Record<string, string> = {
    "seller.approved": "Your alkemart shop was approved",
    "seller.suspended": "Your alkemart shop status changed",
    "seller.unsuspended": "Your alkemart shop was reinstated",
    "seller.terminated": "Your alkemart shop was closed",
  }
  const subject =
    subjectMap[opts.event] || `alkemart shop update: ${opts.event}`
  const reasonLine = opts.reason ? `\n\nNote: ${opts.reason}` : ""
  const text = `Hello,

Update for shop “${opts.shopName}”: ${opts.event.replace("seller.", "").replace(/_/g, " ")}.
${reasonLine}

Sign in to Seller Hub to continue setup or list products.

— alkemart`
  return {
    to: opts.to,
    subject,
    text,
    tags: [opts.event],
  }
}

export function productLifecycleEmail(opts: {
  to: string
  productTitle: string
  event: string
  message?: string | null
}): EmailMessage {
  const subjectMap: Record<string, string> = {
    "product.published": "Product approved on alkemart",
    "product.rejected": "Product not approved on alkemart",
    "product.change-requested": "Changes requested on your product",
  }
  const subject =
    subjectMap[opts.event] || `alkemart product update: ${opts.event}`
  const msgLine = opts.message ? `\n\nMessage from ops: ${opts.message}` : ""
  const text = `Hello,

Product “${opts.productTitle}”: ${opts.event.replace("product.", "").replace(/-/g, " ")}.
${msgLine}

Open Seller Hub → Products to review.

— alkemart`
  return {
    to: opts.to,
    subject,
    text,
    tags: [opts.event],
  }
}
