import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { encodeEmail } from "../../email"
import { notificationSweepMessage, publishJob } from "../../jobs"
import { newsletterConfirmEmail } from "../../lib/email-templates"
import { orderEmailLinks } from "../../lib/order-emails"
import { checkEmailAction, signEmailAction } from "../../lib/preview-token"
import { readJsonBody } from "../../lib/session"

const SubscribeBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.string().trim().max(40).optional().nullable(),
})
const TokenBody = z.object({ token: z.string().min(10).max(600) })

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))

/** One opaque token per email + action — the address never sits readable in a URL. */
export async function newsletterToken(secret: string, action: "confirm" | "unsubscribe", email: string) {
  return `${b64(email)}.${await signEmailAction(secret, `newsletter-${action}`, email)}`
}

async function readToken(secret: string, action: "confirm" | "unsubscribe", token: string) {
  const [enc, sig] = token.split(".")
  if (!enc || !sig) return null
  let email: string
  try {
    email = unb64(enc)
  } catch {
    return null
  }
  return (await checkEmailAction(secret, `newsletter-${action}`, email, sig)) ? email : null
}

/**
 * Newsletter, double opt-in. Signing up never reveals whether an address was
 * already on the list; only confirmed addresses are mailed; every email has a
 * one-tap unsubscribe that works forever.
 */
export const storeNewsletter = new Hono<AppEnv>()
  .post("/", async (c) => {
    const parsed = SubscribeBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "Enter a valid email address." })
    const { email, source } = parsed.data
    const status = await c.get("newsletter").subscribe(email, source ?? null)
    const origin = orderEmailLinks(c).storefrontUrl
    if (status === "pending" && origin) {
      const secret = c.get("jwtSecret")
      const day = new Date().toISOString().slice(0, 10)
      await c.get("checkoutRepo").enqueueNotification({
        // At most one confirm email per address per day, however often they press the button.
        key: `newsletter-confirm:${email}:${day}`,
        recipient: email,
        channel: "email",
        category: "transactional",
        body: encodeEmail(
          newsletterConfirmEmail({
            confirmUrl: `${origin}/newsletter?action=confirm&t=${encodeURIComponent(await newsletterToken(secret, "confirm", email))}`,
            unsubscribeUrl: `${origin}/newsletter?action=unsubscribe&t=${encodeURIComponent(await newsletterToken(secret, "unsubscribe", email))}`,
          }),
        ),
      })
      // Drain the outbox now — otherwise the email waits for the next unrelated event.
      const jobs = c.get("jobs")
      if (jobs) await publishJob(jobs, "notifications", notificationSweepMessage())
    }
    return c.json({ ok: true })
  })
  .post("/confirm", async (c) => {
    const parsed = TokenBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid link" })
    const email = await readToken(c.get("jwtSecret"), "confirm", parsed.data.token)
    if (!email) throw new HTTPException(400, { message: "This link isn't valid." })
    const ok = await c.get("newsletter").confirm(email)
    return c.json({ ok })
  })
  .post("/unsubscribe", async (c) => {
    const parsed = TokenBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid link" })
    const email = await readToken(c.get("jwtSecret"), "unsubscribe", parsed.data.token)
    if (!email) throw new HTTPException(400, { message: "This link isn't valid." })
    await c.get("newsletter").unsubscribe(email)
    return c.json({ ok: true })
  })
