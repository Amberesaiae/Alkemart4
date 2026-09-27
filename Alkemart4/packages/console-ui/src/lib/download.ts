/**
 * Save a file the API streams (CSV statements, order exports), keeping the
 * server's filename. Auth is passed in so each console uses its own session.
 */
export async function downloadFile(url: string, token?: string | null): Promise<void> {
  const res = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw Object.assign(new Error(data.error || data.message || `HTTP ${res.status}`), { status: res.status })
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "alkemart.csv"
  const href = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement("a"), { href, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
