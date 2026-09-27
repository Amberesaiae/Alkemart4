/** Newsletter (double opt-in) — mirrors apps/api/src/routes/store/newsletter.ts. */
import { apiJson } from "./http"

const post = <T,>(path: string, body: unknown) =>
  apiJson<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

export const subscribeNewsletter = (email: string, source: string) => post<{ ok: true }>("/store/newsletter", { email, source })
export const confirmNewsletter = (token: string) => post<{ ok: boolean }>("/store/newsletter/confirm", { token })
export const unsubscribeNewsletter = (token: string) => post<{ ok: true }>("/store/newsletter/unsubscribe", { token })
