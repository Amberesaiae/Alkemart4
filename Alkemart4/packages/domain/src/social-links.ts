/**
 * Seller social links. Sellers type what they know — "@accramart",
 * "tiktok.com/@accramart", "024 412 3456" — and we store one canonical
 * https URL on an allow-listed host, so buyers only ever get sent to the
 * real platform (never a look-alike domain).
 */
export type SocialKind = "tiktok" | "instagram" | "facebook" | "whatsapp"
export const SOCIAL_KINDS: SocialKind[] = ["tiktok", "instagram", "facebook", "whatsapp"]

const HOSTS: Record<SocialKind, string[]> = {
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  whatsapp: ["wa.me", "whatsapp.com"],
}
const BASE: Record<Exclude<SocialKind, "whatsapp">, string> = {
  tiktok: "https://www.tiktok.com/@",
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
}
/** Platform handle rules (letters, digits, dot, underscore; FB also allows dash). */
const HANDLE_RE: Record<Exclude<SocialKind, "whatsapp">, RegExp> = {
  tiktok: /^[A-Za-z0-9._]{2,24}$/,
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  facebook: /^[A-Za-z0-9.\-_]{3,80}$/,
}

export type SocialResult = { ok: true; url: string | null } | { ok: false; message: string }

const hostAllowed = (kind: SocialKind, host: string) => HOSTS[kind].some((d) => host === d || host.endsWith(`.${d}`))

/**
 * Normalise one link. Empty input means "remove". `dialCode` turns a local
 * phone number ("024…") into international form for WhatsApp.
 */
export function normalizeSocial(kind: SocialKind, input: string | null | undefined, dialCode = "233"): SocialResult {
  const raw = (input ?? "").trim()
  if (!raw) return { ok: true, url: null }

  if (kind === "whatsapp") {
    const digits = raw.replace(/[^\d+]/g, "")
    if (/^\+?\d{9,15}$/.test(digits)) {
      const intl = digits.startsWith("+") ? digits.slice(1) : digits.startsWith("0") ? dialCode + digits.slice(1) : digits
      if (intl.length < 10 || intl.length > 15) return { ok: false, message: "That doesn't look like a WhatsApp number." }
      return { ok: true, url: `https://wa.me/${intl}` }
    }
  }

  const looksLikeUrl = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/|$)/i.test(raw)
  if (looksLikeUrl) {
    let u: URL
    try {
      u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    } catch {
      return { ok: false, message: "That link doesn't look right." }
    }
    const host = u.hostname.toLowerCase()
    if (!hostAllowed(kind, host)) return { ok: false, message: `Use a ${label(kind)} link (${HOSTS[kind][0]}).` }
    if (kind === "whatsapp") {
      const n = host === "wa.me" || host.endsWith(".wa.me") ? u.pathname.replace(/\D/g, "") : ""
      if (n.length >= 10 && n.length <= 15) return { ok: true, url: `https://wa.me/${n}` }
      // Business catalogue / channel links on whatsapp.com stay as they are.
      if (host.endsWith("whatsapp.com") && u.pathname.length > 1) return { ok: true, url: `https://${host}${u.pathname}` }
      return { ok: false, message: "Use your WhatsApp number or a wa.me link." }
    }
    if (u.pathname.length <= 1) return { ok: false, message: `Add your ${label(kind)} page, not just the homepage.` }
    return { ok: true, url: `https://${host.replace(/^m\./, "www.")}${u.pathname.replace(/\/+$/, "")}` }
  }

  if (kind === "whatsapp") return { ok: false, message: "Use your WhatsApp number, e.g. 024 412 3456." }
  const handle = raw.replace(/^@/, "")
  if (!HANDLE_RE[kind].test(handle)) return { ok: false, message: `That isn't a valid ${label(kind)} username.` }
  return { ok: true, url: BASE[kind] + handle }
}

/** What to show buyers: "@accramart", or the number for WhatsApp. */
export function socialHandle(kind: SocialKind, url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/^\/+|\/+$/g, "")
    if (kind === "whatsapp") return u.hostname.endsWith("wa.me") ? `+${path}` : "WhatsApp"
    if (!path) return label(kind)
    const first = path.split("/")[0]!
    return first.startsWith("@") ? first : kind === "facebook" && first === "profile.php" ? label(kind) : `@${first}`
  } catch {
    return label(kind)
  }
}

function label(kind: SocialKind) {
  return kind === "tiktok" ? "TikTok" : kind === "instagram" ? "Instagram" : kind === "facebook" ? "Facebook" : "WhatsApp"
}
