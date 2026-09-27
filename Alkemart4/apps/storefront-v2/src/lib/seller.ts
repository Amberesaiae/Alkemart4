/** Seller identity as the API reports it — every field optional, never invented. */
export type SellerRef = {
  id?: string | null
  name?: string | null
  handle?: string | null
}
