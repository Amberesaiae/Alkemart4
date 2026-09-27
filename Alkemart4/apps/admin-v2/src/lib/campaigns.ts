/** Campaigns — mirrors apps/api/src/routes/admin/campaigns.ts. */
import { api } from "./http"

export type CampaignStatus = "draft" | "review" | "scheduled" | "live" | "ended"
export type Objective = "sale" | "launch" | "clearance" | "brand"
export type Transition = "submit" | "approve" | "publish" | "end" | "reopen"

export type Placement = { code: string; job: string; maxLive: number; constraints: { minProducts: number; requiresImage: boolean } }
export type Terms = { id: string; label: string; summary: string; finePrint: string | null; startsAt: string | null; endsAt: string | null }
export type Creative = { id: string; campaignId: string; slot: string; title: string; subtitle: string | null; imageUrl: string | null; link: string | null; position: number }
export type Campaign = {
  id: string
  name: string
  trackingId: string
  objective: Objective
  placementCode: string
  status: CampaignStatus
  priority: number
  sponsored: boolean
  termsId: string | null
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
}
export type CampaignDetail = {
  campaign: Campaign
  creatives: Creative[]
  productSet: { id: string; productIds: string[] } | null
  sellerSet: { id: string; sellerIds: string[] } | null
  terms: Terms | null
  audit: { id: string; actor: string | null; action: string; createdAt: string }[]
}
export type Report = { views: number; selects: number; byCreative: { creativeId: string; views: number; selects: number }[] }

const enc = encodeURIComponent
export const listPlacements = () => api<{ items: Placement[] }>("/admin/campaigns/placements").then((r) => r.items)
export const listTerms = () => api<{ items: Terms[] }>("/admin/campaigns/terms").then((r) => r.items)
export const createTerms = (t: { label: string; summary: string; finePrint?: string | null }) => api<{ terms: Terms }>("/admin/campaigns/terms", { method: "POST", json: t }).then((r) => r.terms)
export const listCampaigns = () => api<{ items: Campaign[] }>("/admin/campaigns").then((r) => r.items)
export const getCampaign = (id: string) => api<CampaignDetail>(`/admin/campaigns/${enc(id)}`)
export const createCampaign = (c: { name: string; placementCode: string; objective?: Objective; startsAt?: string | null; endsAt?: string | null; sponsored?: boolean }) =>
  api<{ campaign: Campaign }>("/admin/campaigns", { method: "POST", json: c }).then((r) => r.campaign)
export const updateCampaign = (id: string, p: Partial<Pick<Campaign, "name" | "objective" | "placementCode" | "priority" | "sponsored" | "termsId" | "startsAt" | "endsAt">>) =>
  api<{ campaign: Campaign }>(`/admin/campaigns/${enc(id)}`, { method: "PATCH", json: p }).then((r) => r.campaign)
export const transitionCampaign = (id: string, action: Transition) => api<{ campaign: Campaign }>(`/admin/campaigns/${enc(id)}/transitions`, { method: "POST", json: { action } })
export const deleteCampaign = (id: string) => api(`/admin/campaigns/${enc(id)}`, { method: "DELETE" })
export const addCreative = (id: string, c: { title: string; subtitle?: string | null; imageUrl?: string | null; link?: string | null; slot?: "desktop" | "mobile" }) =>
  api(`/admin/campaigns/${enc(id)}/creatives`, { method: "POST", json: c })
export const removeCreative = (id: string, creativeId: string) => api(`/admin/campaigns/${enc(id)}/creatives/${enc(creativeId)}`, { method: "DELETE" })
export const setProducts = (id: string, productIds: string[]) => api(`/admin/campaigns/${enc(id)}/products`, { method: "POST", json: { productIds } })
export const setSellers = (id: string, sellerIds: string[]) => api(`/admin/campaigns/${enc(id)}/sellers`, { method: "POST", json: { sellerIds } })
export const getReport = (id: string) => api<Report>(`/admin/campaigns/${enc(id)}/report`)
