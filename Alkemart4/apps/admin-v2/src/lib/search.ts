/** Search insights & vocabulary — mirrors apps/api/src/routes/admin/aliases.ts. */
import { api } from "./http"

export type SearchInsights = {
  days: number
  searches: number
  zeroResultSearches: number
  top: { query: string; count: number; avgResults: number }[]
  zero: { query: string; count: number; lastAt: string }[]
  byDay: { date: string; searches: number; zero: number }[]
}
export type Alias = { id: string; term: string; target: string; type: "synonym" | "redirect"; status: "proposed" | "approved" | "rejected"; createdAt: string }

export const getSearchInsights = (days: number) => api<SearchInsights>(`/admin/search/insights?days=${days}`)
export const listAliases = () => api<{ items: Alias[] }>("/admin/aliases").then((r) => r.items)
export const reviewAlias = (id: string, decision: "approved" | "rejected") => api(`/admin/aliases/${encodeURIComponent(id)}/review`, { method: "POST", json: { decision } })
/** An admin's own fix is proposed and approved in one step (both audited). */
export async function addAlias(term: string, target: string, type: "synonym" | "redirect") {
  const { alias } = await api<{ alias: Alias }>("/admin/aliases", { method: "POST", json: { term, target, type } })
  await reviewAlias(alias.id, "approved")
  return alias
}
