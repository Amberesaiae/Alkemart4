/**
 * Short-lived, single-purpose preview tokens ("homepage draft"). They are
 * NOT session JWTs — a different format and a purpose-bound HMAC — so a
 * leaked preview link can only show a draft for 30 minutes, never act as a
 * user.
 */
const enc = new TextEncoder()
export const PREVIEW_TTL_MS = 30 * 60 * 1000

async function mac(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)))
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function mintPreviewToken(secret: string, purpose: string, nowMs = Date.now()) {
  const exp = nowMs + PREVIEW_TTL_MS
  return `pv1.${exp}.${await mac(secret, `${purpose}:${exp}`)}`
}

export async function checkPreviewToken(secret: string, purpose: string, token: string | undefined | null, nowMs = Date.now()) {
  if (!token || !secret) return false
  const [v, expRaw, sig] = token.split(".")
  const exp = Number(expRaw)
  if (v !== "pv1" || !Number.isFinite(exp) || exp < nowMs || !sig) return false
  const expected = await mac(secret, `${purpose}:${exp}`)
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

/**
 * Stateless signed link for one email + action (newsletter confirm /
 * unsubscribe). No expiry: an unsubscribe link must keep working forever.
 */
export async function signEmailAction(secret: string, action: string, email: string) {
  return mac(secret, `${action}:${email.toLowerCase()}`)
}

export async function checkEmailAction(secret: string, action: string, email: string, token: string | null | undefined) {
  if (!token || !secret) return false
  const expected = await signEmailAction(secret, action, email)
  if (expected.length !== token.length) return false
  let diff = 0
  for (let i = 0; i < token.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  return diff === 0
}
