/**
 * Admin sessions expire after one hour and are scoped to this browser tab.
 * This reduces persistence, not XSS exposure; admin MFA is still required.
 */
const KEY = "alkemart_admin_session"

export type AdminSession = {
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

export function readSession(): AdminSession | null {
  try {
    localStorage.removeItem(KEY) // Discard previously persistent admin sessions.
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as AdminSession
    if (!s?.token || !s.user?.id) return null
    const exp = expiry(s.token)
    if (exp == null || exp <= Date.now()) {
      sessionStorage.removeItem(KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

export function writeSession(s: AdminSession | null) {
  try {
    localStorage.removeItem(KEY)
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s))
    else sessionStorage.removeItem(KEY)
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
