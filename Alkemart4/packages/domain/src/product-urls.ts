/**
 * Product URL handles (Jumia-style slug URLs).
 *
 * Public product URLs serialize as `{slug}-{id}` — human-readable, stable,
 * and always resolvable because the trailing id stays authoritative:
 * - `/product/leather-sandals-b9e0be86-…` → canonical
 * - `/product/b9e0be86-…` (bare id) → resolves, canonicalizes to the slug form
 * - `/product/leather-sandals` (bare slug) → resolves when unique
 *
 * Slugs are URL handles, never identity: renames must not break links, and
 * a wrong slug with a right id still lands on the right product.
 */

/** UUID v4 (or any 8-4-4-4-12 hex) at the end of a ref, with or without slug. */
const TRAILING_ID = /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")
  return slug
}

/** Canonical URL ref for a product: `{slug}-{id}`, or bare id when untitled. */
export function toProductRef(title: string, id: string): string {
  const slug = slugifyTitle(title)
  return slug ? `${slug}-${id}` : id
}

/**
 * Split a URL ref into a slug hint and an authoritative id (or null when
 * the ref carries no id). Never throws; unknown shapes resolve to nulls.
 */
export function parseProductRef(ref: string): { slug: string | null; id: string | null } {
  const key = ref.trim()
  if (!key) return { slug: null, id: null }
  const m = key.match(TRAILING_ID)
  if (m) {
    const slug = key.slice(0, key.length - m[0].length) || null
    return { slug, id: m[1] }
  }
  // Bare 36-char id without a slug prefix.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    return { slug: null, id: key }
  }
  return { slug: key, id: null }
}
