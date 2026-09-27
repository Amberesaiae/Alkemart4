/**
 * Transactional email. Production sends via Resend (https://resend.com) once
 * RESEND_API_KEY and EMAIL_FROM are set; until then the log stub prints what
 * would have been sent. Like SMS, routes only ENQUEUE into the notifications
 * outbox (channel "email"); the dispatch job sends, so a provider outage
 * never blocks a checkout or a password reset request.
 */
export type EmailInput = { to: string; subject: string; html: string; text: string }

export interface EmailProvider {
  send(input: EmailInput): Promise<{ messageId: string }>
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly cfg: { apiKey: string; from: string; replyTo?: string },
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(input: EmailInput) {
    const res = await this.fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.cfg.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(this.cfg.replyTo ? { reply_to: this.cfg.replyTo } : {}),
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok || !data.id) throw new Error(`Resend rejected email (${res.status}${data.message ? `: ${data.message}` : ""})`)
    return { messageId: data.id }
  }
}

export class LogEmailProvider implements EmailProvider {
  async send(input: EmailInput) {
    console.log(JSON.stringify({ job: "email-stub", to: input.to, subject: input.subject, text: input.text }))
    return { messageId: `log-${Date.now()}` }
  }
}

/** Test double: records sends, fails on demand. */
export class InMemoryEmailProvider implements EmailProvider {
  readonly sent: EmailInput[] = []
  failNext = 0
  async send(input: EmailInput) {
    if (this.failNext > 0) {
      this.failNext -= 1
      throw new Error("email provider down")
    }
    this.sent.push(input)
    return { messageId: `mem-${this.sent.length}` }
  }
}

export function emailProviderFromEnv(env: { RESEND_API_KEY?: string; EMAIL_FROM?: string; EMAIL_REPLY_TO?: string }): EmailProvider {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return new ResendEmailProvider({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM, replyTo: env.EMAIL_REPLY_TO })
  }
  return new LogEmailProvider()
}

/** Outbox body for channel "email": the rendered message as JSON. */
export function encodeEmail(e: Omit<EmailInput, "to">): string {
  return JSON.stringify(e)
}

export function decodeEmail(body: string): Omit<EmailInput, "to"> {
  const parsed = JSON.parse(body) as Partial<EmailInput>
  if (!parsed.subject || !parsed.html || !parsed.text) throw new Error("malformed email outbox body")
  return { subject: parsed.subject, html: parsed.html, text: parsed.text }
}
