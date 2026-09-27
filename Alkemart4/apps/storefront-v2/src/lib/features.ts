/**
 * Storefront feature switches. ⚖ Compare is built (API, compare mode, side by
 * side page) but held back for the first deploy (owner, 2026-09-27): comparison
 * displays are hidden and the entry point says "coming soon". Flip to true
 * (and mount `/store/compare` in apps/api/src/index.ts) to bring it back.
 */
export const COMPARE_ENABLED = false
