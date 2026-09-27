/**
 * Transactional email templates. Plain, accessible HTML (single column, real
 * text not images, 16px+ body, dark-on-light, a visible link fallback) with a
 * matching plain-text part. Brand: gold #FEBF31 on ink #111114.
 */
type Rendered = { subject: string; html: string; text: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

function layout(opts: { preheader: string; heading: string; paragraphs: string[]; cta?: { label: string; url: string }; footer?: string }) {
  const body = opts.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#111114">${esc(p)}</p>`).join("")
  const cta = opts.cta
    ? `<p style="margin:24px 0"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#FEBF31;color:#111114;font-weight:700;font-size:16px;text-decoration:none;padding:14px 24px;border-radius:999px">${esc(opts.cta.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#5c5c66">Or paste this link into your browser:<br><span style="word-break:break-all">${esc(opts.cta.url)}</span></p>`
    : ""
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;background:#f6f6f7;font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px 28px">
<tr><td>
<p style="margin:0 0 24px;font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#111114">alkemart</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#111114">${esc(opts.heading)}</h1>
${body}${cta}
<p style="margin:24px 0 0;font-size:13px;color:#5c5c66">${esc(opts.footer ?? "You're getting this because of activity on your alkemart account.")}</p>
</td></tr></table></td></tr></table></body></html>`
}

function textOf(heading: string, paragraphs: string[], cta?: { label: string; url: string }) {
  return [heading, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.url}`] : []), "", "— alkemart"].join("\n")
}

export function passwordResetEmail(p: { url: string; minutes: number }): Rendered {
  const heading = "Reset your password"
  const paragraphs = [
    "Someone (hopefully you) asked to reset the password for this alkemart account.",
    `The link works once and expires in ${p.minutes} minutes. If you didn't ask for this, ignore this email — your password stays the same.`,
  ]
  const cta = { label: "Choose a new password", url: p.url }
  return { subject: heading, html: layout({ preheader: "Your password reset link", heading, paragraphs, cta }), text: textOf(heading, paragraphs, cta) }
}

export function passwordChangedEmail(): Rendered {
  const heading = "Your password was changed"
  const paragraphs = [
    "The password on your alkemart account was just changed.",
    "If this wasn't you, reset your password straight away and contact support.",
  ]
  return { subject: heading, html: layout({ preheader: heading, heading, paragraphs }), text: textOf(heading, paragraphs) }
}

export function orderPlacedEmail(p: {
  reference: string
  total: string
  url: string
  payOnDelivery: boolean
  /** One per seller: the code the buyer gives at handover. */
  handover?: { code: string; seller: string; pickup: boolean }[]
}): Rendered {
  const heading = `Order ${p.reference} is in`
  const codes = (p.handover ?? []).map((h) =>
    h.pickup
      ? `Pickup code for ${h.seller}: ${h.code}. Show it at the shop when you collect.`
      : `Handover code for ${h.seller}: ${h.code}. Give it to the rider only once you have your items.`,
  )
  const paragraphs = [
    `Thanks for your order. Total: ${p.total}.`,
    ...codes,
    p.payOnDelivery
      ? "You'll pay when it arrives — check your items with the rider first. alkemart never asks you to pay before a pay-on-delivery order arrives."
      : "Your payment is confirmed. Each seller is now preparing their part.",
    "You can follow every step, with dates, on your order page.",
    ...(codes.length ? ["Never share the code before you have your items — it confirms delivery and releases payment to the seller."] : []),
  ]
  const cta = { label: "Track your order", url: p.url }
  return { subject: heading, html: layout({ preheader: `Order ${p.reference} confirmed`, heading, paragraphs, cta }), text: textOf(heading, paragraphs, cta) }
}

export function orderStatusEmail(p: { reference: string; status: "shipped" | "delivered"; sellerName: string; url: string; eta?: string | null }): Rendered {
  const heading = p.status === "shipped" ? `Order ${p.reference} is on the way` : `Order ${p.reference} was delivered`
  const paragraphs =
    p.status === "shipped"
      ? [`${p.sellerName} has sent your package.${p.eta ? ` Expected ${p.eta}.` : ""}`]
      : [`${p.sellerName} marked your package as delivered.`, "Tell other buyers how it went — your review is verified because you really bought it."]
  const cta = { label: p.status === "shipped" ? "Track your order" : "Review your order", url: p.url }
  return { subject: heading, html: layout({ preheader: heading, heading, paragraphs, cta }), text: textOf(heading, paragraphs, cta) }
}

export function sellerNewOrderEmail(p: { reference: string; items: string; sendBy: string | null; url: string }): Rendered {
  const heading = `New order ${p.reference}`
  const paragraphs = [`You have a new order: ${p.items}.`, p.sendBy ? `Please send it by ${p.sendBy}.` : "Please pack and send it soon."]
  const cta = { label: "Open the order", url: p.url }
  return { subject: heading, html: layout({ preheader: heading, heading, paragraphs, cta }), text: textOf(heading, paragraphs, cta) }
}

export function newsletterConfirmEmail(p: { confirmUrl: string; unsubscribeUrl: string }): Rendered {
  const heading = "Confirm your subscription"
  const paragraphs = [
    "Thanks for signing up for alkemart deals and new shops.",
    "Tap the button to confirm it's you. If you didn't sign up, ignore this email and you won't hear from us.",
  ]
  const cta = { label: "Yes, subscribe me", url: p.confirmUrl }
  return {
    subject: heading,
    html: layout({ preheader: "One tap to confirm", heading, paragraphs, cta, footer: `Changed your mind? Unsubscribe: ${p.unsubscribeUrl}` }),
    text: textOf(heading, paragraphs, cta) + `\n\nUnsubscribe: ${p.unsubscribeUrl}`,
  }
}

export function sellerProblemReportedEmail(p: { reference: string; note: string; url: string }): Rendered {
  const heading = `A buyer reported a problem with ${p.reference}`
  const paragraphs = [
    `The buyer says: "${p.note}"`,
    "The payment for this order is on hold until it's sorted. Contact the buyer from the order page — most problems are fixed with a quick call, a swap or a refund.",
  ]
  const cta = { label: "Open the order", url: p.url }
  return { subject: heading, html: layout({ preheader: heading, heading, paragraphs, cta }), text: textOf(heading, paragraphs, cta) }
}

/** Any step on a return, to the buyer or the seller: what happened and what's next. */
export function returnUpdateEmail(p: { heading: string; paragraphs: string[]; url: string; cta: string }): Rendered {
  const cta = { label: p.cta, url: p.url }
  return { subject: p.heading, html: layout({ preheader: p.paragraphs[0] ?? p.heading, heading: p.heading, paragraphs: p.paragraphs, cta }), text: textOf(p.heading, p.paragraphs, cta) }
}
