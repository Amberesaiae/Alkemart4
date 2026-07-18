/**
 * Pure helpers for /store/alkemart/catalog product mapping.
 */

export type CatalogProductRow = {
  id: unknown
  title?: unknown
  handle?: unknown
  thumbnail?: unknown
  description?: unknown
  variants?: unknown
  seller?: unknown
}

export type CatalogCard = {
  id: string
  title: unknown
  handle: unknown
  thumbnail: unknown
  description: unknown
  offer_id: string
  seller: {
    id: string | null
    name: string | null
    handle: string | null
  } | null
}

export function mapPublishedProductWithOffer(
  p: CatalogProductRow,
): CatalogCard | null {
  const id = typeof p.id === "string" ? p.id : ""
  if (!id) return null

  const variants = Array.isArray(p.variants)
    ? (p.variants as { offer_id?: string }[])
    : []
  const offerId =
    variants
      .map((v) => v.offer_id)
      .find((oid) => typeof oid === "string" && oid) || null
  if (!offerId) return null

  const seller = p.seller as
    | { id?: string; name?: string; handle?: string }
    | null
    | undefined

  return {
    id,
    title: p.title,
    handle: p.handle,
    thumbnail: p.thumbnail,
    description: p.description,
    offer_id: offerId,
    seller: seller
      ? {
          id: seller.id ?? null,
          name: seller.name ?? null,
          handle: seller.handle ?? null,
        }
      : null,
  }
}

export function paginate<T>(items: T[], offset: number, limit: number): T[] {
  const o = Math.max(0, offset)
  const l = Math.max(1, limit)
  return items.slice(o, o + l)
}
