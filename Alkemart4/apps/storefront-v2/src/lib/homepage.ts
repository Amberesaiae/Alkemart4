import type { HomeSection } from "@alkemart/shared/homepage"
import { getAlkemartApiUrl } from "./env"

/** `preview` is an admin's signed draft link token (30 min); invalid ones fall back to live. */
export async function fetchHomepageSections(preview?: string): Promise<HomeSection[]> {
  const base = getAlkemartApiUrl()
  if (!base) return []
  const qs = preview ? `?preview=${encodeURIComponent(preview)}` : ""
  const response = await fetch(`${base}/store/homepage${qs}`, { headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error("homepage content unavailable")
  const data = await response.json() as { sections?: HomeSection[] }
  return Array.isArray(data.sections) ? data.sections : []
}
