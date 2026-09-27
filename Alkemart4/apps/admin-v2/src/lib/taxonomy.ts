/** Category tree admin — mirrors apps/api/src/routes/admin/taxonomy.ts. */
import { api } from "./http"

export type CategoryNode = {
  id: string
  code: string | null
  canonicalName: string
  displayName: string | null
  slug: string | null
  handle: string
  parentId: string | null
  level: number
  status: "proposed" | "active" | "deprecated"
  isBrowseable: boolean
  isAssignable: boolean
  isNavVisible: boolean
  attributeProfileId: string | null
  replacementNodeId: string | null
  googleCategoryId: number | null
  sortOrder: number
}

export type CategoryPatch = Partial<Pick<CategoryNode, "displayName" | "isBrowseable" | "isAssignable" | "isNavVisible" | "sortOrder" | "parentId">> & {
  name?: string
  status?: "active"
}

export type Suggestion = { kind: "other_bucket" | "failed_match" | "thin_category"; ref: string; reason: string; count: number; sample: string[] }

export const listCategories = () => api<{ items: CategoryNode[] }>("/admin/taxonomy").then((r) => r.items)
export const createCategory = (input: { code: string; name: string; displayName?: string | null; parentId?: string | null }) =>
  api<{ node: CategoryNode }>("/admin/taxonomy", { method: "POST", json: input }).then((r) => r.node)
export const updateCategory = (id: string, patch: CategoryPatch) =>
  api<{ node: CategoryNode }>(`/admin/taxonomy/${encodeURIComponent(id)}`, { method: "PATCH", json: patch }).then((r) => r.node)
export const retireCategory = (id: string, replacementId: string) =>
  api<{ node: CategoryNode }>(`/admin/taxonomy/${encodeURIComponent(id)}/deprecate`, { method: "POST", json: { replacementId } }).then((r) => r.node)
export const listSuggestions = () => api<{ proposals: Suggestion[] }>("/admin/taxonomy/proposals/review").then((r) => r.proposals)

export const labelOf = (n: Pick<CategoryNode, "displayName" | "canonicalName">) => n.displayName || n.canonicalName
