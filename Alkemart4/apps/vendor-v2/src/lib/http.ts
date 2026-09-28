import { downloadFile } from "@workspace/console-ui/lib/download"
import { getApiUrl } from "./env"
import { readSession, writeSession } from "./session"
import { workosBrowser, workosEnabled } from "./workos"

/** `status` is undefined for network failures (offline, DNS, CORS). */
export type ApiError = Error & { status?: number }

/**
 * JSON call to the Workers API with the seller's token. A 401 ends the
 * session (expired / revoked). Network errors never do — a dropped
 * connection must not sign a seller out (CONSOLE-REDESIGN V6).
 */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const token = workosEnabled ? (await workosBrowser.restore())?.token : readSession()?.token
  let res: Response
  try {
    res = await fetch(`${getApiUrl()}${path}`, {
      ...rest,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      headers: {
        accept: "application/json",
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(rest.headers as Record<string, string> | undefined),
      },
    })
  } catch (cause) {
    throw Object.assign(new Error("Network error", { cause }), { status: undefined }) as ApiError
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string }
  if (!res.ok) {
    if (res.status === 401 && token) writeSession(null)
    const err: ApiError = new Error(data.error || data.message || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

/** Download a file from the API with this console's session (CSV exports, statements). */
export const download = async (path: string) => downloadFile(`${getApiUrl()}${path}`, workosEnabled ? (await workosBrowser.restore())?.token : readSession()?.token)
