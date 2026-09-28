import type { Context } from "hono"
import type { VendorProductDto } from "../catalog-repository"
import type { AppEnv } from "../context"

/**
 * Photos a seller removes stop costing storage. When a listing drops a photo
 * (gallery edit, cover change, option photo, or the listing is deleted), its
 * stored files — the original plus the WebP and thumb variants the upload
 * made (routes/vendor/uploads.ts) — are deleted, but only when:
 *  - it's this seller's own upload (`/media/products/{sellerId}/…`), and
 *  - none of the seller's listings still uses it.
 * Shop logos and banners follow the same rule when a seller replaces them.
 * Anything else (pasted URLs, another owner's key, admin merch) is left alone.
 * Best effort: a failed delete never fails the seller's edit.
 */
const MEDIA_KEY = /\/media\/((products|logos|banners)\/([A-Za-z0-9_-]+)\/[A-Za-z0-9_-]+)(?:\.thumb)?\.(?:jpg|png|webp|gif)$/

/**
 * Base key (`{kind}/{owner}/{uuid}`), kind and owner for one of our media
 * URLs — `/media/…` on the API, or a key on the public media domain.
 */
export function mediaBase(url: string, publicBase?: string): { base: string; kind: string; owner: string } | null {
  let path: string
  try {
    const pub = publicBase?.replace(/\/$/, "")
    path = pub && url.startsWith(`${pub}/`) ? `/media/${url.slice(pub.length + 1)}` : new URL(url, "http://x").pathname
  } catch {
    return null
  }
  const m = MEDIA_KEY.exec(path)
  return m ? { base: m[1]!, kind: m[2]!, owner: m[3]! } : null
}

/** Every file one upload may have produced. */
export const variantKeys = (base: string) => ["jpg", "png", "webp", "gif", "thumb.webp"].map((ext) => `${base}.${ext}`)

/** Every photo URL a listing uses. */
export function photosOf(p: VendorProductDto): string[] {
  return [
    p.product.imageUrl,
    ...p.images.map((i) => i.url),
    ...p.options.flatMap((o) => o.values.map((v) => v.imageUrl)),
  ].filter((u): u is string => !!u)
}

/**
 * Delete the stored files for `candidates` that the seller no longer uses
 * anywhere. Returns the base keys deleted (for tests and logs).
 */
const mediaEnv = (c: Context<AppEnv>) => (c.env ?? {}) as { MEDIA_BUCKET?: R2Bucket; MEDIA_PUBLIC_URL?: string }

export async function deleteUnusedPhotos(c: Context<AppEnv>, sellerId: string, candidates: string[]): Promise<string[]> {
  const { MEDIA_BUCKET: bucket, MEDIA_PUBLIC_URL: pub } = mediaEnv(c)
  if (!bucket || candidates.length === 0) return []
  const run = async () => {
    const mine = [...new Set(candidates)].map((u) => mediaBase(u, pub)).filter((b): b is NonNullable<typeof b> => !!b && b.kind === "products" && b.owner === sellerId)
    if (mine.length === 0) return []
    const inUse = new Set(
      (await c.get("repo").listVendorProducts(sellerId))
        .flatMap(photosOf)
        .map((u) => mediaBase(u, pub)?.base)
        .filter(Boolean),
    )
    const gone = [...new Set(mine.map((b) => b.base))].filter((b) => !inUse.has(b))
    if (gone.length) await bucket.delete(gone.flatMap(variantKeys))
    return gone
  }
  try {
    return await run()
  } catch (err) {
    console.warn(JSON.stringify({ job: "media-cleanup", sellerId, error: err instanceof Error ? err.message : String(err) }))
    return []
  }
}

/** A replaced shop logo/banner (this seller's own upload) is deleted. */
export async function deleteReplacedShopArt(c: Context<AppEnv>, sellerId: string, replaced: (string | null | undefined)[]): Promise<string[]> {
  const { MEDIA_BUCKET: bucket, MEDIA_PUBLIC_URL: pub } = mediaEnv(c)
  const bases = [...new Set(replaced.filter((u): u is string => !!u).map((u) => mediaBase(u, pub)))]
    .filter((b): b is NonNullable<typeof b> => !!b && (b.kind === "logos" || b.kind === "banners") && b.owner === sellerId)
    .map((b) => b.base)
  if (!bucket || bases.length === 0) return []
  try {
    await bucket.delete(bases.flatMap(variantKeys))
    return bases
  } catch (err) {
    console.warn(JSON.stringify({ job: "media-cleanup", sellerId, error: err instanceof Error ? err.message : String(err) }))
    return []
  }
}
