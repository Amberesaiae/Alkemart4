import { apiJson } from "./http"
import { ensureWorkersAccessToken } from "./auth"

/**
 * Verified-purchase review for one delivered seller order. The server checks
 * delivery and that the email matches the order; reviews start pending
 * moderation, so nothing appears on the product until approved.
 */
export async function submitReview(input: {
  orderId: string
  buyerEmail: string
  rating: number
  title?: string | null
  body: string
}): Promise<{ status: "pending" | "published" }> {
  const token = await ensureWorkersAccessToken()
  if (!token) throw new Error("Sign in to review your order")
  const r = await apiJson<{ review: { status: "pending" | "published" } }>("/store/reviews", { method: "POST", body: JSON.stringify(input), token })
  return { status: r.review.status }
}
