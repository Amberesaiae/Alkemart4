import { getMedusaClient } from "./medusa"
import { getAlkemartApiUrl } from "./env"

export type WishlistProduct = {
  id: string
  title: string
  handle: string
  thumbnail?: string | null
}

type WishlistResponse = {
  products: WishlistProduct[]
  count: number
  offset: number
  limit: number
}

function useWorkersWishlist(): boolean {
  return Boolean(getAlkemartApiUrl())
}

export async function getWishlist(): Promise<WishlistResponse> {
  if (useWorkersWishlist()) {
    return { products: [], count: 0, offset: 0, limit: 20 }
  }
  const sdk = getMedusaClient()
  return sdk.client.fetch("/store/wishlist", { method: "GET" })
}

export async function addToWishlist(
  reference_id: string,
): Promise<void> {
  if (useWorkersWishlist()) {
    throw new Error("Wishlist is not available on Workers yet")
  }
  const sdk = getMedusaClient()
  await sdk.client.fetch("/store/wishlist", {
    method: "POST",
    body: { reference: "product", reference_id },
  })
}

export async function removeFromWishlist(
  reference_id: string,
): Promise<void> {
  if (useWorkersWishlist()) {
    throw new Error("Wishlist is not available on Workers yet")
  }
  const sdk = getMedusaClient()
  await sdk.client.fetch(`/store/wishlist/product/${reference_id}`, {
    method: "DELETE",
  })
}
