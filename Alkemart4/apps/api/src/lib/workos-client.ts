import { z } from "zod"
import { decodeJwt } from "jose"

/** Backend only. This transport does not issue local sessions or grant roles. */
export type WorkosConfig = { apiKey: string; clientId: string }

export class WorkosAuthenticationError extends Error {
  constructor(readonly reason: "rejected" | "unavailable" | "invalid_response") {
    // Never attach provider bodies, keys, pending tokens, or fetch errors.
    super(`WorkOS authentication ${reason}`)
    this.name = "WorkosAuthenticationError"
  }
}

const Authentication = z.object({
  user: z.object({
    id: z.string().startsWith("user_"),
    email: z.string().email(),
    email_verified: z.boolean(),
  }),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  impersonator: z.unknown().optional(),
})

export type WorkosAuthentication = {
  user: { id: string; email: string; emailVerified: boolean }
  accessToken: string
  refreshToken: string
  providerSessionId: string
  accessExpiresAt: number
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Store state + verifier server-side with expiry and atomic single-use consumption. */
export async function createWorkosChallenge() {
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return { state, verifier, challenge: base64url(new Uint8Array(digest)) }
}

export function workosAuthorizationUrl(input: {
  clientId: string
  redirectUri: string
  state: string
  challenge: string
  signUp?: boolean
  /** Skip the hosted AuthKit page and go straight to the provider (our own UI offers the choice). */
  provider?: "GoogleOAuth"
}) {
  const callback = new URL(input.redirectUri)
  const local = callback.hostname === "localhost" || callback.hostname === "127.0.0.1"
  if ((callback.protocol !== "https:" && !(local && callback.protocol === "http:"))
    || callback.username || callback.password || callback.search || callback.hash) {
    throw new Error("Invalid WorkOS callback URL")
  }
  if (!input.clientId.startsWith("client_") || !/^[\w-]{43}$/.test(input.state)
    || !/^[\w-]{43}$/.test(input.challenge)) throw new Error("Invalid WorkOS authorization parameters")
  const url = new URL("https://api.workos.com/user_management/authorize")
  url.search = new URLSearchParams({
    client_id: input.clientId,
    provider: input.provider ?? "authkit",
    response_type: "code",
    redirect_uri: callback.href,
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
    ...(input.provider ? {} : { screen_hint: input.signUp ? "sign-up" : "sign-in" }),
  }).toString()
  return url.href
}

async function authenticate(
  config: WorkosConfig,
  grant: Record<string, string>,
  fetcher: typeof fetch,
): Promise<WorkosAuthentication> {
  if (!config.apiKey || !config.clientId.startsWith("client_")) throw new Error("WorkOS configuration missing")
  let response: Response
  try {
    response = await fetcher("https://api.workos.com/user_management/authenticate", {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: config.clientId, client_secret: config.apiKey, ...grant }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new WorkosAuthenticationError("unavailable")
  }
  if (!response.ok) {
    throw new WorkosAuthenticationError(response.status === 429 || response.status >= 500 ? "unavailable" : "rejected")
  }
  let body: unknown
  try { body = await response.json() } catch { throw new WorkosAuthenticationError("invalid_response") }
  const parsed = Authentication.safeParse(body)
  if (!parsed.success) throw new WorkosAuthenticationError("invalid_response")
  const data = parsed.data
  // Pilot does not support impersonated commerce sessions or unverified identities.
  if (!data.user.email_verified || data.impersonator != null) throw new WorkosAuthenticationError("rejected")
  // This JWT comes only from the fixed HTTPS authenticated backchannel, never
  // from a request. Read its session identifier/expiry; do not trust role claims.
  let claims
  try { claims = decodeJwt(data.access_token) } catch { throw new WorkosAuthenticationError("invalid_response") }
  if (claims.sub !== data.user.id || typeof claims.sid !== "string" || !claims.sid.startsWith("session_")
    || typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) throw new WorkosAuthenticationError("invalid_response")
  return {
    user: { id: data.user.id, email: data.user.email, emailVerified: true },
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    providerSessionId: claims.sid,
    accessExpiresAt: claims.exp,
  }
}

export function exchangeWorkosCode(config: WorkosConfig, code: string, verifier: string, fetcher: typeof fetch = fetch) {
  if (!code || code.length > 2048 || !/^[A-Za-z0-9_-]{43}$/.test(verifier)) {
    throw new WorkosAuthenticationError("rejected")
  }
  return authenticate(config, { grant_type: "authorization_code", code, code_verifier: verifier }, fetcher)
}

/** Caller must atomically replace the previous refresh token; never retry blindly. */
export function refreshWorkosSession(config: WorkosConfig, refreshToken: string, fetcher: typeof fetch = fetch) {
  if (!refreshToken || refreshToken.length > 8192) throw new WorkosAuthenticationError("rejected")
  return authenticate(config, { grant_type: "refresh_token", refresh_token: refreshToken }, fetcher)
}

export async function revokeWorkosSession(config: WorkosConfig, sessionId: string, fetcher: typeof fetch = fetch) {
  if (!sessionId.startsWith("session_")) throw new WorkosAuthenticationError("rejected")
  try {
    const response = await fetcher("https://api.workos.com/user_management/sessions/revoke", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
    if (!response.ok) throw new Error("rejected")
  } catch { throw new WorkosAuthenticationError("unavailable") }
}

/** Email a six-digit Magic Auth code (expires in 10 minutes). Never reveals whether the email has an account. */
export async function sendMagicAuthCode(config: WorkosConfig, email: string, fetcher: typeof fetch = fetch) {
  if (!config.apiKey) throw new Error("WorkOS configuration missing")
  let response: Response
  try {
    response = await fetcher("https://api.workos.com/user_management/magic_auth", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email }),
    })
  } catch { throw new WorkosAuthenticationError("unavailable") }
  if (!response.ok) throw new WorkosAuthenticationError(response.status === 429 || response.status >= 500 ? "unavailable" : "rejected")
}

export function authenticateWithMagicCode(config: WorkosConfig, email: string, code: string, fetcher: typeof fetch = fetch) {
  if (!/^\d{6}$/.test(code) || !email || email.length > 320) throw new WorkosAuthenticationError("rejected")
  return authenticate(config, { grant_type: "urn:workos:oauth:grant-type:magic-auth:code", code, email }, fetcher)
}
