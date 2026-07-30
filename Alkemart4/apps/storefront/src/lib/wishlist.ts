import { getMedusaClient } from "./medusa"

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

export async function getWishlist(): Promise<WishlistResponse> {
  const sdk = getMedusaClient()
  return sdk.client.fetch("/store/wishlist", { method: "GET" })
}

export async function addToWishlist(
  reference_id: string,
): Promise<void> {
  const sdk = getMedusaClient()
  await sdk.client.fetch("/store/wishlist", {
    method: "POST",
    body: { reference: "product", reference_id },
  })
}

export async function removeFromWishlist(
  reference_id: string,
): Promise<void> {
  const sdk = getMedusaClient()
  await sdk.client.fetch(`/store/wishlist/product/${reference_id}`, {
    method: "DELETE",
  })
}
