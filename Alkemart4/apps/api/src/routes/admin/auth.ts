import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { issueSession, loginAs } from "../../lib/session"

/**
 * The admin account a Cloudflare Access identity signs in as. It is its own
 * row (not the person's shopping account, which may share the Gmail) so the
 * audit log names the person and buyer/admin roles never mix.
 */
export function accessAdminEmail(email: string) {
  const [local, domain] = email.split("@")
  return `${local}+console@${domain}`
}

export const adminAuth = new Hono<AppEnv>()
  // Local development only: production admin signs in through Access below.
  .post("/login", (c) => loginAs(c, "admin"))
  /**
   * Production sign-in from the Cloudflare Access pass (Google, approved
   * emails only — verified by requireAdminAccess before this runs). The first
   * sign-in creates that person's admin account with no usable password.
   */
  .post("/access", async (c) => {
    if (c.env?.ENVIRONMENT !== "production") throw new HTTPException(404, { message: "not_found" })
    const identity = c.get("adminAccessEmail")
    if (!identity) throw new HTTPException(403, { message: "access_required" })
    const repo = c.get("authRepo")
    const email = accessAdminEmail(identity)
    let user = await repo.findUserByEmail(email)
    if (!user) {
      // Not a password hash format: verifyPassword can never accept it.
      await repo.createUser({ id: crypto.randomUUID(), email, passwordHash: `access-only$${crypto.randomUUID()}`, role: "admin" })
      await repo.markEmailVerified((await repo.findUserByEmail(email))!.id)
      user = await repo.findUserByEmail(email)
    }
    if (!user || user.role !== "admin") throw new HTTPException(403, { message: "access_denied" })
    console.info(JSON.stringify({ event: "admin-access-login", userId: user.id }))
    return c.json(await issueSession(c, user))
  })
