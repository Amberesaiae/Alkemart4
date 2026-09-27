/** Reported conversations and product questions — mirrors apps/api/src/routes/admin/messages.ts. */
import type { ChatBubble } from "@workspace/console-ui/components/console/chat"
import { api } from "./http"

export type ReportedThread = {
  id: string
  sellerName: string | null
  buyerName: string
  productTitle: string | null
  orderReference: string | null
  reportedBy: "buyer" | "seller" | null
  reportReason: string | null
  reportedAt: string | null
  blocked: boolean
  last: { body: string; sender: "buyer" | "seller"; at: string } | null
}
export type AdminQuestion = { id: string; productId: string; sellerName: string | null; askerName: string; question: string; answer: string | null; askedAt: string; hidden: boolean }

export const listReported = () => api<{ items: ReportedThread[] }>("/admin/messages/reported")
export const readReported = (id: string) => api<{ thread: ReportedThread; messages: ChatBubble[] }>(`/admin/messages/${encodeURIComponent(id)}`)
export const resolveReport = (id: string, action: "dismiss" | "close") => api<{ ok: true }>(`/admin/messages/${encodeURIComponent(id)}/resolve`, { method: "POST", json: { action } })
export const listAdminQuestions = () => api<{ items: AdminQuestion[] }>("/admin/messages/questions")
export const setQuestionHidden = (id: string, hide: boolean) => api<{ ok: true }>(`/admin/messages/questions/${encodeURIComponent(id)}/${hide ? "hide" : "show"}`, { method: "POST" })
