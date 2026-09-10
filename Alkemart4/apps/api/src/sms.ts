/**
 * Buyer SMS for fulfillment events. Production sends via Africa's Talking
 * (sender ID must be NCA-registered before prod); dev/test use the log stub
 * or the in-memory double. The provider never blocks order writes — routes
 * only enqueue, and the dispatch job sends.
 */
export type SmsInput = {
  to: string
  body: string
}

export interface SmsProvider {
  send(input: SmsInput): Promise<{ messageId: string }>
}

/** Normalize Ghana mobile input to E.164 (+233…). Null when not derivable. */
export function toE164Ghana(phone: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (phone.trim().startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`
  }
  if (digits.startsWith("233") && digits.length === 12) return `+${digits}`
  if (digits.startsWith("0") && digits.length === 10) return `+233${digits.slice(1)}`
  if (digits.length === 9) return `+233${digits}`
  return null
}

export class AfricasTalkingSmsProvider implements SmsProvider {
  constructor(
    private readonly cfg: { username: string; apiKey: string; senderId?: string },
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(input: SmsInput): Promise<{ messageId: string }> {
    const params = new URLSearchParams({ username: this.cfg.username, to: input.to, message: input.body })
    if (this.cfg.senderId) params.set("from", this.cfg.senderId)
    const res = await this.fetchFn("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: { apiKey: this.cfg.apiKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })
    if (!res.ok) throw new Error(`Africa's Talking rejected SMS (${res.status})`)
    const data = (await res.json().catch(() => ({}))) as {
      SMSMessageData?: { Recipients?: { messageId?: string; status?: string }[] }
    }
    const first = data.SMSMessageData?.Recipients?.[0]
    if (!first || (first.status && !/success|sent/i.test(first.status))) {
      throw new Error(`Africa's Talking failed SMS (${first?.status ?? "unknown"})`)
    }
    return { messageId: first.messageId ?? `${Date.now()}` }
  }
}

export class LogSmsProvider implements SmsProvider {
  async send(input: SmsInput): Promise<{ messageId: string }> {
    console.log(JSON.stringify({ job: "sms-stub", to: input.to, body: input.body }))
    return { messageId: `log-${Date.now()}` }
  }
}

/** Test double: records sends, fails on demand. */
export class InMemorySmsProvider implements SmsProvider {
  readonly sent: SmsInput[] = []
  failNext = 0

  async send(input: SmsInput): Promise<{ messageId: string }> {
    if (this.failNext > 0) {
      this.failNext -= 1
      throw new Error("SMS provider down")
    }
    this.sent.push(input)
    return { messageId: `mem-${this.sent.length}` }
  }
}

export function smsProviderFromEnv(env: {
  AT_USERNAME?: string
  AT_API_KEY?: string
  AT_SENDER_ID?: string
}): SmsProvider {
  if (env.AT_USERNAME && env.AT_API_KEY) {
    return new AfricasTalkingSmsProvider({
      username: env.AT_USERNAME,
      apiKey: env.AT_API_KEY,
      senderId: env.AT_SENDER_ID,
    })
  }
  return new LogSmsProvider()
}
