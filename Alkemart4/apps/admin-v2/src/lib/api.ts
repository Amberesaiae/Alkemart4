/**
 * Admin API — Workers only. Shapes mirror apps/api/src/routes/admin/*.
 * Errors propagate; nothing falls back to fake data.
 */
import { api } from "./http"
import { writeSession, type AdminSession } from "./session"

export async function signIn(email: string, password: string) {
  const s = await api<AdminSession>("/admin/auth/login", { method: "POST", json: { email: email.trim(), password } })
  writeSession(s)
  return s
}

/** Production: sign in from the Cloudflare Access pass (Google). 404 locally, where there is no Access. */
export async function signInWithAccess() {
  const s = await api<AdminSession>("/admin/auth/access", { method: "POST" })
  writeSession(s)
  return s
}

export function signOut() {
  writeSession(null)
}

export type Me = { userId: string; role: string; email?: string }
export const getMe = () => api<Me>("/admin/me")

// ─── Overview ────────────────────────────────────────────────────────────

export type PlatformStats = {
  total_orders: number
  total_gmv_ghs: number
  active_sellers: number
  catalog_size: number
  gmv_last_30_days: { date: string; amount: number }[]
  top_products: { title: string; thumbnail: string | null; units: number; gmv: number }[]
}
export const getStats = () => api<PlatformStats>("/admin/stats")

export type Traffic = {
  views30d: number
  series: { date: string; views: number }[]
  top_shops: { sellerId: string; name: string; handle: string | null; views: number }[]
}
export const getTraffic = () => api<Traffic>("/admin/stats/traffic")

// ─── Queues (counts for "Needs attention") ───────────────────────────────

export type AdminSeller = {
  id: string
  name: string
  handle: string
  status: "pending_approval" | "open" | "suspended" | "terminated"
  ownerEmail: string | null
  orderCount: number
  gmvPesewas: string
}
export const listSellers = () => api<{ items: AdminSeller[] }>("/admin/sellers").then((r) => r.items)

export type ReviewReason = { code: string; message: string; field?: string }
export type ListingReview = {
  id: string
  productId: string
  decision: "submitted" | "approve" | "reject" | "request_changes" | "escalate"
  reviewer: "seller" | "system" | "ai" | "admin"
  reviewerId: string | null
  reasons: ReviewReason[]
  note: string | null
  model: string | null
  confidence: number | null
  createdAt: string
}
export type AdminListing = {
  id: string
  title: string
  description: string | null
  status: "draft" | "proposed" | "published" | "rejected"
  primaryCategoryId: string
  sellerId: string | null
  imageUrl: string | null
  sellerName: string | null
  sellerHandle: string | null
  flags: { rule: string; message: string }[]
  review: ListingReview | null
}
export const listListings = (status?: "draft" | "proposed" | "published" | "rejected") =>
  api<{ items: AdminListing[] }>(`/admin/products${status ? `?status=${status}` : ""}`).then((r) => r.items)

export type ListingDetail = {
  product: { id: string; title: string; description: string | null; status: string; primaryCategoryId: string; imageUrl: string | null; createdAt: string | null }
  images: { url: string; alt: string | null }[]
  options: { id: string; name: string; values: { id: string; value: string }[] }[]
  variants: { variant: { id: string; sku: string | null }; offer: { pricePesewas: string; onHand: number; active: boolean; condition: string | null }; options: Record<string, string> }[]
  offer: { pricePesewas: string; onHand: number; active: boolean; condition: string | null }
}
export const getListing = (id: string) => api<ListingDetail>(`/admin/products/${encodeURIComponent(id)}`)
export const listingReviews = (id: string) =>
  api<{ reviews: ListingReview[] }>(`/admin/products/${encodeURIComponent(id)}/reviews`).then((r) => r.reviews)

export type Decision = "approve" | "request_changes" | "reject"
export const decideListing = (id: string, decision: Decision, body: { reasons?: ReviewReason[]; note?: string | null }) =>
  api<{ product: { status: string } }>(
    `/admin/products/${encodeURIComponent(id)}/${decision === "request_changes" ? "request-changes" : decision}`,
    { method: "POST", json: body },
  )

export type ReviewMode = "trust" | "manual" | "assist" | "auto"
export const getReviewMode = () => api<{ mode: ReviewMode }>("/admin/products/review-settings").then((r) => r.mode)
export const setReviewMode = (mode: ReviewMode) =>
  api<{ mode: ReviewMode }>("/admin/products/review-settings", { method: "PUT", json: { mode } }).then((r) => r.mode)

export type TaxonomyNode = { id: string; canonicalName: string; displayName: string | null; parentId: string | null }
export const listTaxonomy = () => api<{ nodes?: TaxonomyNode[]; items?: TaxonomyNode[] }>("/admin/taxonomy").then((r) => r.nodes ?? r.items ?? [])

export const listAppeals = () => api<{ appeals: { id: string }[] }>("/admin/appeals").then((r) => r.appeals)
export const listPendingReviews = () => api<{ reviews: { id: string }[] }>("/admin/reviews").then((r) => r.reviews)
