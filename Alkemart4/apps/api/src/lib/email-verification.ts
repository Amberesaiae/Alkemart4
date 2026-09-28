import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AuthUser, UserRole } from "../auth-repository"
import type { AppEnv } from "../context"
import { encodeEmail } from "../email"
import { emailVerificationEmail } from "./email-templates"
import { notificationSweepMessage, publishJob } from "../jobs"
import { appOrigin } from "./password-reset"

const TTL_MINUTES = 30
const MAX_PER_WINDOW = 3
const ConfirmBody = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) })

async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function sendEmailVerification(c: Context<AppEnv>, user: AuthUser, app: "storefront" | "vendor"): Promise<void> {
  if (user.emailVerifiedAt) return
  const origin = appOrigin(c, app)
  const checkout = c.get("checkoutRepo")
  const recent = await checkout.countRecentSends(user.email, "email", new Date(Date.now() - 15 * 60_000))
  if (recent >= MAX_PER_WINDOW) return
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("")
  await c.get("accounts").createEmailVerificationToken({
    userId: user.id,
    tokenHash: await sha256Hex(token),
    expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
  })
  await checkout.enqueueNotification({
    key: `verify-email:${user.id}:${crypto.randomUUID()}`,
    recipient: user.email,
    channel: "email",
    category: "transactional",
    body: encodeEmail(emailVerificationEmail({ url: `${origin}/verify-email?token=${token}`, minutes: TTL_MINUTES })),
  })
  await publishJob(c.get("jobs"), "notifications", notificationSweepMessage()).catch(() => undefined)
}

export async function requestEmailVerification(c: Context<AppEnv>, role: UserRole, app: "storefront" | "vendor") {
  const auth = c.get("auth")
  if (auth.role !== role) throw new HTTPException(403, { message: "forbidden" })
  const user = await c.get("authRepo").findUserById(auth.userId)
  if (!user || user.role !== role) throw new HTTPException(401, { message: "unauthorized" })
  await sendEmailVerification(c, user, app)
  return c.json({ ok: true, verified: Boolean(user.emailVerifiedAt) }, 202)
}

export async function confirmEmailVerification(c: Context<AppEnv>, role: UserRole) {
  const parsed = ConfirmBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) throw new HTTPException(400, { message: "Invalid or expired verification link" })
  const userId = await c.get("accounts").consumeEmailVerificationToken(await sha256Hex(parsed.data.token))
  if (!userId) throw new HTTPException(400, { message: "Invalid or expired verification link" })
  const user = await c.get("authRepo").findUserById(userId)
  if (!user || user.role !== role) throw new HTTPException(400, { message: "Invalid or expired verification link" })
  await c.get("authRepo").markEmailVerified(userId)
  return c.json({ ok: true, userId })
}
