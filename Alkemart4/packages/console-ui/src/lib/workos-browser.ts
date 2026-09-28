/** Hosted AuthKit adapter. Only five-minute access tokens live in memory.
 * The backend owns the HttpOnly session cookie and encrypted refresh token. */
export type MarketplaceSession = {
  token: string
  user: { id: string; email: string; role: string; sellerId?: string; emailVerified?: boolean }
}
export class WorkosBrowser {
  private session: MarketplaceSession | null = null
  private inflight: Promise<MarketplaceSession | null> | null = null
  private logoutPending = false
  private generation = 0
  private apiOrigin: () => string
  private actor: "store" | "vendor"
  constructor(apiOrigin: () => string, actor: "store" | "vendor") {
    this.apiOrigin = apiOrigin
    this.actor = actor
  }
  peek() { return this.session }
  clear() { this.generation += 1; this.session = null }
  private endpoint(path: string) { return `${this.apiOrigin()}/${this.actor}/auth/workos/${path}` }
  private expiresSoon() {
    if (!this.session) return true
    try {
      const payload = JSON.parse(atob(this.session.token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number }
      return !payload.exp || payload.exp * 1000 <= Date.now() + 30_000
    } catch { return true }
  }
  async restore(force = false): Promise<MarketplaceSession | null> {
    if (this.logoutPending) return null
    if (!force && !this.expiresSoon()) return this.session
    if (this.inflight) return this.inflight
    const generation = this.generation
    this.inflight = (async () => {
      // One retry for a concurrent tab's refresh lock, never retries a provider token itself.
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch(this.endpoint("session"), { method: "POST", credentials: "include", headers: { Accept: "application/json" } })
        if (response.status === 409 && attempt === 0) { await new Promise((resolve) => setTimeout(resolve, 500)); continue }
        if (response.status === 401) { this.session = null; return null }
        if (!response.ok) throw new Error("Secure sign-in is temporarily unavailable. Please try again.")
        const session = await response.json() as MarketplaceSession
        if (!session.token || !session.user?.id) throw new Error("Invalid authentication response")
        if (this.logoutPending || generation !== this.generation) return null
        this.session = session
        return session
      }
      throw new Error("Sign-in is busy in another tab. Please try again.")
    })()
    try { return await this.inflight } finally { this.inflight = null }
  }
  async start(input: { mode?: "login" | "register"; redirect?: string; link?: { email: string; password: string }; shop?: { name: string; handle: string } }) {
    const response = await fetch(this.endpoint("start"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })
    if (!response.ok) throw new Error(response.status === 401 ? "The existing account details don’t match." : "Could not start secure sign-in. Please try again.")
    const { url } = await response.json() as { url: string }
    const target = new URL(url)
    if (target.origin !== "https://api.workos.com" || target.pathname !== "/user_management/authorize") throw new Error("Invalid sign-in destination")
    window.location.assign(target.href)
  }
  async logout() {
    this.logoutPending = true
    this.clear()
    try {
      const response = await fetch(this.endpoint("logout"), { method: "POST", credentials: "include" })
      if (!response.ok) throw new Error("Could not complete sign-out. Please try again.")
    } finally {
      this.logoutPending = false
    }
  }
}
