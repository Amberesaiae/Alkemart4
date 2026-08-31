export type SessionRole = "buyer" | "seller_member" | "admin"

export type SessionClaims = {
  userId: string
  role: SessionRole
  sellerId?: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const ROLES = new Set<string>(["buyer", "seller_member", "admin"])
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function b64UrlToBytes(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function jsonToB64Url(value: unknown): string {
  return bytesToB64Url(encoder.encode(JSON.stringify(value)))
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)))
}

function parseClaims(payload: unknown): SessionClaims {
  if (!payload || typeof payload !== "object") throw new Error("invalid token")
  const p = payload as Record<string, unknown>
  if (typeof p.exp === "number" && p.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("expired token")
  }
  if (typeof p.userId !== "string" || !p.userId) throw new Error("invalid token")
  if (typeof p.role !== "string" || !ROLES.has(p.role)) throw new Error("invalid token")
  const sellerId = p.sellerId
  if (sellerId !== undefined && (typeof sellerId !== "string" || !sellerId)) {
    throw new Error("invalid token")
  }
  return {
    userId: p.userId,
    role: p.role as SessionRole,
    ...(sellerId ? { sellerId } : {}),
  }
}

export async function signSessionJwt(
  claims: SessionClaims,
  secret: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: Record<string, unknown> = {
    userId: claims.userId,
    role: claims.role,
    sub: claims.userId,
    iat: now,
    exp: now + ttlSeconds,
  }
  if (claims.sellerId) payload.sellerId = claims.sellerId
  const body = `${jsonToB64Url({ alg: "HS256", typ: "JWT" })}.${jsonToB64Url(payload)}`
  const sig = await hmacSha256(secret, body)
  return `${body}.${bytesToB64Url(sig)}`
}

export async function verifySessionJwt(token: string, secret: string): Promise<SessionClaims> {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new Error("invalid token")
  const body = `${parts[0]}.${parts[1]}`
  const actual = await hmacSha256(secret, body)
  const expected = b64UrlToBytes(parts[2])
  if (!timingSafeEqual(actual, expected)) throw new Error("invalid token")
  let payload: unknown
  try {
    payload = JSON.parse(decoder.decode(b64UrlToBytes(parts[1])))
  } catch {
    throw new Error("invalid token")
  }
  return parseClaims(payload)
}
