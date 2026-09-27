import { apiJson } from "./http"

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
}): Promise<void> {
  await apiJson("/store/reviews", { method: "POST", body: JSON.stringify(input) })
}
