/**
 * Canonical category photography, by category handle.
 *
 * Single source of truth for department art, shared by the storefront
 * mosaic/rails and the admin studio canvas. Paths are relative to the
 * storefront public dir — resolve against the storefront origin before
 * rendering outside the storefront (the studio uses `storefrontBase()`).
 * Only departments with real photography are listed; everything else
 * falls back to the category icon / honest placeholder.
 */
export type CategoryArt = {
  /** Storefront-public-relative photo, e.g. "/images/categories/food.webp". */
  photo: string
  /** CSS object-position class keeping the subject framed. */
  objectPos: string
}

export const CATEGORY_ART: Readonly<Record<string, CategoryArt>> = {
  "phones-electronics": {
    photo: "/images/categories/generated/electronics-v3.webp",
    objectPos: "object-center",
  },
  "food-groceries": {
    photo: "/images/categories/generated/groceries-v3.webp",
    objectPos: "object-center",
  },
  "health-beauty": {
    photo: "/images/categories/generated/beauty-v3.webp",
    objectPos: "object-center",
  },
  "pet-care": {
    photo: "/images/categories/pets.webp",
    objectPos: "object-[center_15%]",
  },
  "fashion-apparel": {
    photo: "/images/categories/generated/fashion-v3.webp",
    objectPos: "object-center",
  },
}

export function categoryArtFor(handle?: string | null): CategoryArt | undefined {
  if (!handle) return undefined
  return CATEGORY_ART[handle.toLowerCase()]
}
