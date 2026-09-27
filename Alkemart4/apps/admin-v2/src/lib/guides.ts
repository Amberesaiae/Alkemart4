/** Buying guides — mirrors apps/api/src/routes/admin/guides.ts. */
import { api } from "./http"

export type GuidePick = { label?: string | null; categoryHandle?: string | null; query?: string | null; limit?: number | null }
export type GuideSection = { heading: string; body: string; picks: GuidePick[] }
export type Guide = {
  slug: string
  title: string
  excerpt: string
  author: string
  status: "draft" | "published"
  revision: number
  sections: GuideSection[]
  relatedGuides: string[]
  refreshAfter: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}
export type GuidePatch = Partial<Pick<Guide, "title" | "excerpt" | "author" | "sections" | "relatedGuides" | "refreshAfter">>

const enc = encodeURIComponent
export const listGuides = () => api<{ items: Guide[] }>("/admin/guides").then((r) => r.items)
export const createGuide = (g: { slug: string; title: string; excerpt: string; author: string }) => api<{ guide: Guide }>("/admin/guides", { method: "POST", json: g }).then((r) => r.guide)
export const updateGuide = (slug: string, p: GuidePatch) => api<{ guide: Guide }>(`/admin/guides/${enc(slug)}`, { method: "PATCH", json: p }).then((r) => r.guide)
export const publishGuide = (slug: string) => api<{ guide: Guide }>(`/admin/guides/${enc(slug)}/publish`, { method: "POST" }).then((r) => r.guide)
export const unpublishGuide = (slug: string) => api<{ guide: Guide }>(`/admin/guides/${enc(slug)}/unpublish`, { method: "POST" }).then((r) => r.guide)
export const deleteGuide = (slug: string) => api(`/admin/guides/${enc(slug)}`, { method: "DELETE" })
