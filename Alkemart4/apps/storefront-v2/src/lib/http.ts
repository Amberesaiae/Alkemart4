import { getAlkemartApiUrl } from "./env"
import { logout } from "./auth"

let ending = false
function endSession() {
  if (ending || typeof window === "undefined") return
  ending = true
  try {
    sessionStorage.setItem("alkemart.signed_out_reason", "expired")
  } catch {
    /* storage blocked: the URL flag still carries it */
  }
  void logout().then(() => {
    const back = window.location.pathname + window.location.search
    window.location.assign(`/login?expired=1&redirect=${encodeURIComponent(back)}`)
  })
}

export type ApiError = Error & { status?: number }

/**
 * JSON call to the Workers API. Throws an Error carrying `status` on non-2xx
 * with the API's own `error` message when it sent one.
 */
export async function apiJson<T>(
  path: string,
  init?: RequestInit & { token?: string | null },
): Promise<T> {
  const { token, ...rest } = init ?? {}
  const res = await fetch(`${getAlkemartApiUrl()}${path}`, {
    ...rest,
    headers: {
      accept: "application/json",
      ...(rest.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(rest.headers as Record<string, string> | undefined),
    },
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    // A signed-in call refused as unauthorized means the session ended
    // (expired, or the password changed elsewhere): sign out and ask again.
    if (res.status === 401 && token) endSession()
    const err: ApiError = new Error(data.error || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}
