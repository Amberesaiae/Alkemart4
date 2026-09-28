/**
 * Transactional email. Production sends via Resend (https://resend.com) once
 * RESEND_API_KEY and EMAIL_FROM are set; staging/production fail closed if
 * missing. The development stub never logs message content. Routes ENQUEUE into the notifications
 * outbox (channel "email"); the dispatch job sends, so a provider outage
 * never blocks a checkout or a password reset request.
 */
export type EmailInput = { to: string; subject: string; html: string; text: string; idempotencyKey?: string }

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
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, "Content-Type": "application/json", ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}) },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
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
    if (!res.ok || !data.id) throw new Error(`Resend rejected email (${res.status})`)
    return { messageId: data.id }
  }
}

export class LogEmailProvider implements EmailProvider {
  async send(input: EmailInput) {
    // Verification/reset links and private order details must never enter logs.
    console.log(JSON.stringify({ job: "email-stub", outcome: "not-delivered" }))
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

export function emailProviderFromEnv(env: { ENVIRONMENT?: string; RESEND_API_KEY?: string; EMAIL_FROM?: string; EMAIL_REPLY_TO?: string }): EmailProvider {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return new ResendEmailProvider({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM, replyTo: env.EMAIL_REPLY_TO })
  }
  if (env.ENVIRONMENT === "production" || env.ENVIRONMENT === "staging") {
    return { send: async () => { throw new Error("Transactional email is not configured") } }
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
