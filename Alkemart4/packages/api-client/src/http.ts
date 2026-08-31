export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto"
}

const NO_BODY_STATUS = new Set([204, 205, 304])

let _baseUrl = ""

export function setBaseUrl(url: string): void {
  _baseUrl = url.replace(/\/+$/, "")
}

export function getBaseUrl(): string {
  return _baseUrl
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError"
  readonly status: number
  readonly data: T | null

  constructor(status: number, data: T | null, message: string) {
    super(message)
    this.status = status
    this.data = data
  }
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const prefix = _baseUrl
  if (!prefix) return path
  if (path.startsWith("/")) return `${prefix}${path}`
  return `${prefix}/${path}`
}

function messageFromBody(status: number, data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error?: unknown }).error
    if (typeof error === "string" && error.trim()) return `HTTP ${status}: ${error}`
  }
  return `HTTP ${status}`
}

export async function customFetch<T = unknown>(
  input: string,
  options: CustomFetchOptions = {},
): Promise<T> {
  const { responseType = "json", ...init } = options
  const url = resolveUrl(input)
  const headers = new Headers(init.headers)
  if (!headers.has("accept")) headers.set("accept", "application/json")

  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    throw new ApiError(response.status, data, messageFromBody(response.status, data))
  }

  if (NO_BODY_STATUS.has(response.status) || responseType === "text") {
    return (responseType === "text" ? await response.text() : null) as T
  }
  return (await response.json()) as T
}
