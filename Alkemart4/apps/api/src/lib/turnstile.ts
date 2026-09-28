import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../context"

/** Production sign-up requires a verified, single-use challenge for this action/host. */
export async function verifySignupChallenge(c: Context<AppEnv>, token: string | undefined) {
  const env = c.env
  const secret = env?.TURNSTILE_SECRET_KEY
  if (!secret && env?.ENVIRONMENT !== "production") return
  const hosts = env?.TURNSTILE_HOSTNAMES?.split(",").map((h) => h.trim()).filter(Boolean) ?? []
  if (!secret || !hosts.length) throw new HTTPException(503, { message: "signup_protection_unavailable" })
  if (!token) throw new HTTPException(400, { message: "verification_required" })
  let result: { success?: boolean; action?: string; hostname?: string }
  try {
    const body = new URLSearchParams({ secret, response: token })
    const ip = c.req.header("cf-connecting-ip")
    if (ip) body.set("remoteip", ip)
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body, signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error("verification unavailable")
    result = await response.json()
  } catch {
    throw new HTTPException(503, { message: "signup_protection_unavailable" })
  }
  if (!result.success || result.action !== "signup" || !hosts.includes(result.hostname ?? "")) {
    throw new HTTPException(400, { message: "verification_failed" })
  }
}
