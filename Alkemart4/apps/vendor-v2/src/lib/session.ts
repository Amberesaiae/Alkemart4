/**
 * Seller session. The API issues a 7-day bearer JWT (no cookies), so the
 * token is kept on the device until it expires or the seller signs out —
 * sellers stay signed in across tabs and app restarts (CONSOLE-REDESIGN §8).
 */
const KEY = "alkemart_seller_session"

export type SellerSession = {
  token: string
  user: { id: string; email: string; role: string; sellerId?: string }
}

type Listener = () => void
const listeners = new Set<Listener>()

function expiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number }
    return typeof payload.exp === "number" ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function readSession(): SellerSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SellerSession
    if (!s?.token || !s.user?.id) return null
    const exp = expiry(s.token)
    if (exp != null && exp <= Date.now()) {
      localStorage.removeItem(KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

export function writeSession(s: SellerSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked: the session lives for this page only */
  }
  listeners.forEach((l) => l())
}

export function onSessionChange(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
