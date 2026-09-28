import { EncryptJWT, jwtDecrypt } from "jose"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../context"
import type { WorkosActor, WorkosSession } from "../workos-store"
import { passwordVersion } from "../workos-store"
import type { SessionClaims } from "./jwt"

export async function hashWorkosSecret(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join("")
}
async function encryptionKey(secret: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`alkemart-workos-v1:${secret}`)))
}
export async function sealWorkosData(data: Record<string, unknown>, secret: string, ttl: number) {
  return new EncryptJWT(data).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuer("alkemart-workos").setAudience("backend").setIssuedAt().setExpirationTime(`${ttl}s`).encrypt(await encryptionKey(secret))
}
export async function openWorkosData(value: string, secret: string) {
  return (await jwtDecrypt(value, await encryptionKey(secret), { issuer: "alkemart-workos", audience: "backend", keyManagementAlgorithms: ["dir"], contentEncryptionAlgorithms: ["A256GCM"] })).payload
}

export function workosConfig(c: Context<AppEnv>, actor: WorkosActor) {
  const env = c.env
  if (env?.WORKOS_ENABLED !== "1") throw new HTTPException(404, { message: "not_found" })
  const apiKey = env.WORKOS_API_KEY
  const clientId = env.WORKOS_CLIENT_ID
  const secret = env.WORKOS_COOKIE_SECRET
  const api = (actor === "store" ? env.WORKOS_STOREFRONT_API_ORIGIN : env.WORKOS_VENDOR_API_ORIGIN) ?? env.WORKOS_API_ORIGIN
  const app = actor === "store" ? env.STOREFRONT_URL : env.VENDOR_URL
  if (!apiKey || !clientId || !secret || secret.length < 32 || !api || !app) throw new HTTPException(503, { message: "authentication_not_configured" })
  const apiUrl = new URL(api), appUrl = new URL(app)
  const isLocal = (url: URL) => ["localhost", "127.0.0.1"].includes(url.hostname)
  const production = env.ENVIRONMENT === "production"
  for (const url of [apiUrl, appUrl]) {
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
      || (url.protocol !== "https:" && !(isLocal(url) && url.protocol === "http:" && !production))) {
      throw new HTTPException(503, { message: "authentication_origin_invalid" })
    }
  }
  // Default Cloudflare hosts require the same-origin auth bridge. Cross-site
  // cookies are rejected in staging too; owned custom subdomains are also safe.
  const ownedSite = [apiUrl, appUrl].every((u) => u.hostname === "alkemart.com" || u.hostname.endsWith(".alkemart.com"))
  if (!isLocal(apiUrl) && !isLocal(appUrl) && apiUrl.origin !== appUrl.origin && !ownedSite) {
    throw new HTTPException(503, { message: "authentication_same_site_required" })
  }
  if (!production && isLocal(apiUrl) && isLocal(appUrl) && apiUrl.hostname !== appUrl.hostname) {
    throw new HTTPException(503, { message: "authentication_local_hosts_must_match" })
  }
  return { apiKey, clientId, secret, apiOrigin: apiUrl.origin, appOrigin: appUrl.origin, secure: apiUrl.protocol === "https:" }
}

export async function validateWorkosClaims(c: Context<AppEnv>, auth: SessionClaims) {
  if (!auth.sid) {
    // Cutover must invalidate old marketplace bearer credentials, not just
    // hide the password login form. Admin has a separate Access boundary.
    if (c.env?.WORKOS_ENABLED === "1" && auth.role !== "admin") throw new HTTPException(401, { message: "session_expired" })
    return
  }
  if (c.env?.WORKOS_ENABLED !== "1") throw new HTTPException(401, { message: "unauthorized" })
  const row = await c.get("workos").getSession(auth.sid)
  if (!row || row.clientId !== c.env.WORKOS_CLIENT_ID || row.userId !== auth.userId
    || row.actor !== (auth.role === "buyer" ? "store" : "vendor")
    || row.passwordVersion !== String(auth.pwd ?? 0)) throw new HTTPException(401, { message: "session_expired" })
}

export async function workosSessionUser(c: Context<AppEnv>, row: WorkosSession) {
  const user = await c.get("authRepo").findUserById(row.userId)
  if (!user || user.role === "admin" || passwordVersion(user) !== row.passwordVersion || !user.emailVerifiedAt) throw new HTTPException(401, { message: "session_expired" })
  let sellerId: string | undefined
  if (row.actor === "vendor") {
    const member = await c.get("authRepo").findSellerMemberByUserId(user.id)
    const seller = member ? await c.get("authRepo").findSellerById(member.sellerId) : null
    if (!member || !seller || ["suspended", "terminated"].includes(seller.status)) throw new HTTPException(403, { message: "seller_account_restricted" })
    sellerId = member.sellerId
  }
  return { user, sellerId }
}
