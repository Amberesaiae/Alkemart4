import { Hono } from "hono"
import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { verifyPassword } from "@alkemart/domain"
import type { AppEnv } from "../context"
import { WorkosAccountError, passwordVersion, type WorkosActor } from "../workos-store"
import { createWorkosChallenge, exchangeWorkosCode, refreshWorkosSession, revokeWorkosSession, WorkosAuthenticationError, workosAuthorizationUrl } from "../lib/workos-client"
import { hashWorkosSecret, openWorkosData, sealWorkosData, workosConfig, workosSessionUser } from "../lib/workos-session"
import { signSessionJwt } from "../lib/jwt"
import { readJsonBody } from "../lib/session"
import { limitAccountAttempts } from "../lib/auth-rate-limit"

const Start = z.object({
  mode: z.enum(["login", "register"]).default("login"),
  redirect: z.string().max(2048).optional(),
  link: z.object({ email: z.string().email(), password: z.string().min(1).max(200) }).optional(),
  shop: z.object({ name: z.string().trim().min(1).max(80), handle: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(40) }).optional(),
})
const Attempt = z.object({
  actor: z.enum(["store", "vendor"]), clientId: z.string(), verifier: z.string(), redirect: z.string(),
  link: z.object({ userId: z.string(), passwordVersion: z.string() }).optional(),
  shop: z.object({ name: z.string(), handle: z.string() }).optional(),
})
function safePath(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return fallback
  const url = new URL(value, "https://safe.invalid")
  return url.origin === "https://safe.invalid" ? `${url.pathname}${url.search}${url.hash}` : fallback
}
function cookieName(actor: WorkosActor, kind: "attempt" | "session", secure: boolean) { return `${secure ? "__Host-" : ""}alkemart_${actor}_${kind}` }
function checkOrigin(origin: string | undefined, expected: string) {
  if (origin !== expected) throw new HTTPException(403, { message: "invalid_origin" })
}
function cookieParts(cookie: string | undefined) {
  const [id, secret, extra] = (cookie ?? "").split(".")
  return id && secret && !extra && /^[a-f0-9-]{36}$/.test(id) && /^[a-zA-Z0-9_-]{43}$/.test(secret) ? { id, secret } : null
}

export function workosAuth(actor: WorkosActor) {
  const routes = new Hono<AppEnv>()
  routes.get("/config", (c) => {
    if (c.env?.WORKOS_ENABLED !== "1") return c.json({ enabled: false })
    workosConfig(c, actor)
    return c.json({ enabled: true })
  })
  routes.post("/start", async (c) => {
    const cfg = workosConfig(c, actor)
    checkOrigin(c.req.header("Origin"), cfg.appOrigin)
    const parsed = Start.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    let link: { userId: string; passwordVersion: string } | undefined
    if (parsed.data.link) {
      const email = parsed.data.link.email.trim().toLowerCase()
      await limitAccountAttempts(c, "workos-link", email)
      const user = await c.get("authRepo").findUserByEmail(email)
      const dummy = `pbkdf2-sha256$100000$${"00".repeat(16)}$${"00".repeat(32)}`
      const valid = await verifyPassword(parsed.data.link.password, user?.passwordHash ?? dummy)
      if (!valid || !user || user.role === "admin") throw new HTTPException(401, { message: "invalid credentials" })
      link = { userId: user.id, passwordVersion: passwordVersion(user) }
    }
    const { state, verifier, challenge } = await createWorkosChallenge()
    const browser = (await createWorkosChallenge()).state
    await c.get("workos").saveAttempt({
      stateHash: await hashWorkosSecret(state), browserHash: await hashWorkosSecret(browser),
      encryptedData: await sealWorkosData({ actor, clientId: cfg.clientId, verifier, redirect: safePath(parsed.data.redirect, actor === "store" ? "/account" : "/"), ...(link ? { link } : {}), ...(parsed.data.shop ? { shop: parsed.data.shop } : {}) }, cfg.secret, 600),
      expiresAt: new Date(Date.now() + 600_000),
    })
    setCookie(c, cookieName(actor, "attempt", cfg.secure), browser, { path: "/", httpOnly: true, secure: cfg.secure, sameSite: "Lax", maxAge: 600 })
    return c.json({ url: workosAuthorizationUrl({ clientId: cfg.clientId, redirectUri: `${cfg.apiOrigin}/${actor}/auth/workos/callback`, state, challenge, signUp: parsed.data.mode === "register" }) })
  })
  routes.get("/callback", async (c) => {
    const cfg = workosConfig(c, actor)
    const browser = getCookie(c, cookieName(actor, "attempt", cfg.secure))
    deleteCookie(c, cookieName(actor, "attempt", cfg.secure), { path: "/", secure: cfg.secure, httpOnly: true, sameSite: "Lax" })
    const fail = (code: string) => c.redirect(`${cfg.appOrigin}/login?auth_error=${encodeURIComponent(code)}`)
    const state = c.req.query("state")
    if (!state || !/^[\w-]{43}$/.test(state) || !browser) return fail("invalid_state")
    const row = await c.get("workos").consumeAttempt(await hashWorkosSecret(state), await hashWorkosSecret(browser))
    if (!row) return fail("invalid_state")
    let data: z.infer<typeof Attempt>
    try { data = Attempt.parse(await openWorkosData(row.encryptedData, cfg.secret)) } catch { return fail("invalid_state") }
    if (data.actor !== actor || data.clientId !== cfg.clientId || c.req.query("error")) return fail("authentication_failed")
    try {
      const authenticated = await exchangeWorkosCode(cfg, c.req.query("code") ?? "", data.verifier, c.get("workosFetch"))
      const user = await c.get("workos").provision({ clientId: cfg.clientId, subject: authenticated.user.id, email: authenticated.user.email, actor, link: data.link, shop: data.shop })
      const id = crypto.randomUUID(), secret = (await createWorkosChallenge()).state
      const session = {
        id, userId: user.id, subject: authenticated.user.id, clientId: cfg.clientId, actor,
        secretHash: await hashWorkosSecret(secret), encryptedRefresh: await sealWorkosData({ token: authenticated.refreshToken, providerSessionId: authenticated.providerSessionId }, cfg.secret, 604800),
        passwordVersion: passwordVersion(user), expiresAt: new Date(Date.now() + 604800_000), idleExpiresAt: new Date(Date.now() + 86400_000),
        revokedAt: null, lockId: null, createdAt: new Date(),
      }
      await workosSessionUser(c, session)
      // Never silently replace a browser session without revoking its local predecessor.
      const old = cookieParts(getCookie(c, cookieName(actor, "session", cfg.secure)))
      if (old) {
        const previous = await c.get("workos").getSession(old.id)
        if (previous?.secretHash === await hashWorkosSecret(old.secret)) await c.get("workos").revokeSession(old.id)
      }
      await c.get("workos").saveSession(session)
      setCookie(c, cookieName(actor, "session", cfg.secure), `${id}.${secret}`, { path: "/", httpOnly: true, secure: cfg.secure, sameSite: "Lax", maxAge: 604800 })
      console.info(JSON.stringify({ event: "workos-login", actor, userId: user.id, outcome: "success" }))
      return c.redirect(`${cfg.appOrigin}${safePath(data.redirect, actor === "store" ? "/account" : "/")}`)
    } catch (error) {
      console.warn(JSON.stringify({ event: "workos-login", actor, outcome: "rejected" }))
      if (error instanceof WorkosAccountError) return fail(error.code)
      if (error instanceof WorkosAuthenticationError || error instanceof HTTPException) return fail("authentication_failed")
      // Provider/DB errors can include secrets and request bodies. Do not propagate to the global logger.
      return fail("authentication_unavailable")
    }
  })
  routes.post("/session", async (c) => {
    const cfg = workosConfig(c, actor)
    checkOrigin(c.req.header("Origin"), cfg.appOrigin)
    const cookie = cookieParts(getCookie(c, cookieName(actor, "session", cfg.secure)))
    if (!cookie) throw new HTTPException(401, { message: "unauthorized" })
    const lockId = `${Date.now()}:${crypto.randomUUID()}`
    const store = c.get("workos")
    const row = await store.claimRefresh(cookie.id, await hashWorkosSecret(cookie.secret), lockId)
    if (!row) {
      const current = await store.getSession(cookie.id)
      if (current?.lockId && current.secretHash === await hashWorkosSecret(cookie.secret)) throw new HTTPException(409, { message: "session_refresh_in_progress" })
      throw new HTTPException(401, { message: "session_expired" })
    }
    try {
      if (row.actor !== actor || row.clientId !== cfg.clientId) throw new Error("session mismatch")
      const { user, sellerId } = await workosSessionUser(c, row)
      const data = await openWorkosData(row.encryptedRefresh, cfg.secret)
      if (typeof data.token !== "string") throw new Error("invalid session")
      const refreshed = await refreshWorkosSession(cfg, data.token, c.get("workosFetch"))
      if (refreshed.user.id !== row.subject || refreshed.user.email.trim().toLowerCase() !== user.email) throw new Error("identity changed")
      if (refreshed.providerSessionId !== data.providerSessionId) throw new Error("provider session changed")
      // Role and membership are always read from local state; WorkOS metadata is not authorization.
      await workosSessionUser(c, row)
      const rotated = await store.rotateSession(row.id, lockId, await sealWorkosData({ token: refreshed.refreshToken, providerSessionId: refreshed.providerSessionId }, cfg.secret, Math.max(1, Math.floor((row.expiresAt.getTime() - Date.now()) / 1000))))
      if (!rotated) throw new Error("session revoked")
      const role = actor === "store" ? "buyer" : "seller_member"
      const ttl = Math.min(300, refreshed.accessExpiresAt - Math.floor(Date.now() / 1000), Math.floor((row.expiresAt.getTime() - Date.now()) / 1000))
      if (ttl < 1) throw new Error("session expired")
      const token = await signSessionJwt({ userId: user.id, role, sid: row.id, pwd: Number(row.passwordVersion), ...(sellerId ? { sellerId } : {}) }, c.get("jwtSecret"), ttl)
      return c.json({ token, user: { id: user.id, email: user.email, role, emailVerified: true, ...(sellerId ? { sellerId } : {}) } })
    } catch {
      // A failed/uncertain provider refresh is not retried with an already-used credential.
      await store.revokeSession(row.id)
      deleteCookie(c, cookieName(actor, "session", cfg.secure), { path: "/", secure: cfg.secure, httpOnly: true, sameSite: "Lax" })
      throw new HTTPException(401, { message: "session_expired" })
    }
  })
  routes.post("/logout", async (c) => {
    const cfg = workosConfig(c, actor)
    checkOrigin(c.req.header("Origin"), cfg.appOrigin)
    const cookie = cookieParts(getCookie(c, cookieName(actor, "session", cfg.secure)))
    if (cookie) {
      const row = await c.get("workos").getSession(cookie.id)
      if (row?.secretHash === await hashWorkosSecret(cookie.secret)) {
        await c.get("workos").revokeSession(cookie.id)
        try {
          const data = await openWorkosData(row.encryptedRefresh, cfg.secret)
          if (typeof data.providerSessionId !== "string") throw new Error("invalid session")
          await revokeWorkosSession(cfg, data.providerSessionId, c.get("workosFetch"))
        } catch {
          // Local revocation is already durable even when WorkOS is unavailable.
          console.warn(JSON.stringify({ event: "workos-logout", outcome: "provider-revocation-failed" }))
          deleteCookie(c, cookieName(actor, "session", cfg.secure), { path: "/", secure: cfg.secure, httpOnly: true, sameSite: "Lax" })
          throw new HTTPException(503, { message: "provider_logout_unavailable" })
        }
      }
    }
    deleteCookie(c, cookieName(actor, "session", cfg.secure), { path: "/", secure: cfg.secure, httpOnly: true, sameSite: "Lax" })
    return c.json({ ok: true })
  })
  return routes
}
