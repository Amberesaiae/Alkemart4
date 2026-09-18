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
    photo: "/images/categories/electronics.webp",
    objectPos: "object-center",
  },
  "food-groceries": {
    photo: "/images/categories/food.webp",
    objectPos: "object-center",
  },
  "health-beauty": {
    photo: "/images/categories/cosmetics.webp",
    objectPos: "object-[center_20%]",
  },
  "pet-care": {
    photo: "/images/categories/pets.webp",
    objectPos: "object-[center_15%]",
  },
}

export function categoryArtFor(handle?: string | null): CategoryArt | undefined {
  if (!handle) return undefined
  return CATEGORY_ART[handle.toLowerCase()]
}
