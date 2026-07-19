/**
 * DEMO SEED — RETIRED for production.
 * Imports must not invent catalog data. Prefer @/lib/catalog-nav.
 * This module is kept only so accidental imports fail closed.
 */

/** Always false in production-ready storefront */
export function isHomeDemoEnabled(): boolean {
  return false
}

export function isDemoProduct(): boolean {
  return false
}

export const HOME_OFFERS_TARGET = 14

export function resolveHomeCategories<T>(api: T[]): T[] {
  return api
}

export function resolveMosaicCategories<T>(api: T[]): T[] {
  return api
}

export function resolveHomeProducts<T>(api: T[], target?: number): T[] {
  return typeof target === "number" ? api.slice(0, target) : api
}

export function resolveBrowseProducts<T>(api: T[]): T[] {
  return api
}

export function resolveBrowseCategory(): undefined {
  return undefined
}

export const DEMO_PRODUCTS: never[] = []
export const DEMO_CATEGORIES: never[] = []
export const MOSAIC_HANDLES: never[] = []
