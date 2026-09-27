import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { hashPassword } from "@alkemart/domain"
import type { UserRole } from "../auth-repository"
import type { AppEnv } from "../context"
import { encodeEmail } from "../email"
import { notificationSweepMessage, publishJob } from "../jobs"
import { passwordChangedEmail, passwordResetEmail } from "./email-templates"
import { normalizeEmail, readJsonBody } from "./session"

export const RESET_TTL_MINUTES = 60
/** Per-address cap on reset emails in a 15-minute window (the IP limiter covers bursts). */
export const RESET_MAX_PER_WINDOW = 3

const RequestBody = z.object({ email: z.string().email() })
const ConfirmBody = z.object({ token: z.string().min(32).max(128), password: z.string().min(8).max(200) })

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function randomToken() {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("")
}

/**
 * Link origin comes ONLY from configuration — never from request headers —
 * so nobody can make a reset email point at their own site.
 */
export function appOrigin(c: Context<AppEnv>, app: "storefront" | "vendor"): string {
  const env = (c.env ?? {}) as unknown as Record<string, string | undefined>
  const configured = app === "storefront" ? env.STOREFRONT_URL : env.VENDOR_URL
  if (configured) return configured.replace(/\/$/, "")
  if ((env.ENVIRONMENT ?? "development") === "development") {
    return app === "storefront" ? "http://localhost:5176" : "http://localhost:3004"
  }
  throw new HTTPException(503, { message: `${app === "storefront" ? "STOREFRONT_URL" : "VENDOR_URL"} is not configured` })
}

/**
 * POST …/auth/password-reset/request — always 202 with the same body, whether
 * or not the email has an account of this role (no account enumeration).
 */
export async function requestPasswordReset(c: Context<AppEnv>, role: UserRole, app: "storefront" | "vendor") {
  const parsed = RequestBody.safeParse(await readJsonBody(c))
  if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
  const email = normalizeEmail(parsed.data.email)
  const done = () => c.json({ ok: true, message: "If that email has an account, a reset link is on its way." }, 202)
  const user = await c.get("authRepo").findUserByEmail(email)
  if (!user || user.role !== role) return done()
  const checkout = c.get("checkoutRepo")
  const recent = await checkout.countRecentSends(email, "email", new Date(Date.now() - 15 * 60_000)).catch(() => 0)
  if (recent >= RESET_MAX_PER_WINDOW) return done()
  const token = randomToken()
  await c.get("accounts").createResetToken({
    userId: user.id,
    tokenHash: await sha256Hex(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
  })
  const url = `${appOrigin(c, app)}/reset-password?token=${token}`
  await checkout.enqueueNotification({
    key: `password-reset:${user.id}:${Date.now()}`,
    recipient: email,
    channel: "email",
    category: "transactional",
    body: encodeEmail(passwordResetEmail({ url, minutes: RESET_TTL_MINUTES })),
  })
  // Nudge the sender now; the cron sweep is the safety net.
  await publishJob(c.get("jobs"), "notifications", notificationSweepMessage()).catch(() => undefined)
  return done()
}

/** POST …/auth/password-reset/confirm — consumes the token once, sets the password. */
export async function confirmPasswordReset(c: Context<AppEnv>, role: UserRole) {
  const parsed = ConfirmBody.safeParse(await readJsonBody(c))
  if (!parsed.success) throw new HTTPException(400, { message: "Use at least 8 characters for your new password." })
  const userId = await c.get("accounts").consumeResetToken(await sha256Hex(parsed.data.token))
  if (!userId) throw new HTTPException(400, { message: "This reset link has expired or was already used. Ask for a new one." })
  const user = await c.get("authRepo").findUserById(userId)
  if (!user || user.role !== role) throw new HTTPException(400, { message: "This reset link has expired or was already used. Ask for a new one." })
  await c.get("authRepo").updateUserPassword(user.id, await hashPassword(parsed.data.password))
  await c
    .get("checkoutRepo")
    .enqueueNotification({
      key: `password-changed:${user.id}:${Date.now()}`,
      recipient: user.email,
      channel: "email",
      category: "transactional",
      body: encodeEmail(passwordChangedEmail()),
    })
    .catch(() => undefined)
  return c.json({ ok: true })
}
