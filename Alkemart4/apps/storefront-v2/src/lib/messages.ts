import { apiJson } from "./http"
import { getWorkersAccessToken } from "./auth"

/** One conversation with a shop, as the API shows it to the buyer. */
export type Thread = {
  id: string
  sellerId: string
  sellerName: string | null
  productId: string | null
  productTitle: string | null
  orderId: string | null
  orderReference: string | null
  last: { body: string; sender: "buyer" | "seller"; at: string } | null
  unread: boolean
  blocked: boolean
  blockedByYou: boolean
  reported: boolean
  lastMessageAt: string
}

export type Message = { id: string; sender: "buyer" | "seller"; body: string; at: string; warning: string | null }

export type Question = {
  id: string
  sellerId: string
  sellerName: string | null
  askerName: string
  question: string
  answer: string | null
  askedAt: string
  answeredAt: string | null
}

const opts = (init?: RequestInit) => ({ ...init, token: getWorkersAccessToken() })

export const listThreads = () => apiJson<{ items: Thread[]; unread: number; quickReplies: string[] }>("/store/messages", opts())
export const getThread = (id: string) =>
  apiJson<{ thread: Thread; messages: Message[]; quickReplies: string[] }>(`/store/messages/${encodeURIComponent(id)}`, opts())
export const startThread = (input: { sellerId: string; productId?: string; orderId?: string; body: string }) =>
  apiJson<{ thread: Thread; message: Message }>("/store/messages", opts({ method: "POST", body: JSON.stringify(input) }))
export const sendMessage = (id: string, body: string) =>
  apiJson<{ message: Message }>(`/store/messages/${encodeURIComponent(id)}`, opts({ method: "POST", body: JSON.stringify({ body }) }))
export const threadAction = (id: string, action: "block" | "unblock" | "report", reason?: string) =>
  apiJson<{ ok: true }>(`/store/messages/${encodeURIComponent(id)}/${action}`, opts({ method: "POST", body: JSON.stringify(reason ? { reason } : {}) }))

export const listQuestions = (productId: string) => apiJson<{ items: Question[] }>(`/store/questions?productId=${encodeURIComponent(productId)}`)
export const askQuestion = (input: { productId: string; sellerId: string; question: string }) =>
  apiJson<{ question: Question }>("/store/questions", opts({ method: "POST", body: JSON.stringify(input) }))

