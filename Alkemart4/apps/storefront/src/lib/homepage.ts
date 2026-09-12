import type { HomeSection } from "@alkemart/shared/homepage"
import { getAlkemartApiUrl } from "./env"

export async function fetchHomepageSections(): Promise<HomeSection[]> {
  const base = getAlkemartApiUrl()
  if (!base) return []
  const response = await fetch(`${base}/store/homepage`, { headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error("homepage content unavailable")
  const data = await response.json() as { sections?: HomeSection[] }
  return Array.isArray(data.sections) ? data.sections : []
}
