/**
 * Alkemart design tokens — Mowafer system (ui/ Behance packs).
 * Single source. Components never invent palette or layout magic numbers.
 */

export const color = {
  primary: "#FEBF31",
  primaryForeground: "#3C3C3B",
  foreground: "#3C3C3B",
  background: "#F0F0F0", // page canvas (outside white card)
  card: "#FFFFFF",
  muted: "#F5F5F5",
  mutedForeground: "#8A8A8A",
  border: "#EBEBEB",
  destructive: "#F0295A",
  /** Mosaic accents — Mowafer imgi_10 */
  catPet: "#F0295A",
  catFood: "#FEBF31",
  catCosmetics: "#F5A3C7",
  catElectronics: "#50D1C8",
  catBeverages: "#9AC63B",
  catHealth: "#3C3C3B",
  catBaby: "#E8E8E8",
  catFashion: "#7C6CF0",
  catHome: "#F0295A",
  catDefault: "#50D1C8",
  brandDark: "#3C3C3B",
  white: "#FFFFFF",
  star: "#FEBF31",
} as const

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const

/**
 * Corner radii — Mowafer is soft, not bubbly.
 * Product cards: md (12). Mosaic tiles: lg (16). Page shell: xl (20).
 * Avoid 24–32 on commerce cards.
 */
export const radius = {
  sm: 8,
  md: 12, // product card, filter panels
  lg: 16, // mosaic tiles, bands
  xl: 20, // page shell only
  "2xl": 24, // rare
  "3xl": 32, // avoid for cards
  full: 9999,
  /** Semantic aliases for components */
  card: 12,
  tile: 16,
  pill: 9999,
} as const

/** Page-as-card shell (Mowafer floating white board on soft canvas) */
export const layout = {
  /** Outer canvas max — breathing room around white page */
  canvasMax: 1280,
  /** White page content column */
  pageMax: 1100,
  headerHeight: 72,
  categoryRailHeight: 100,
  sidebarWidth: 240,
  cardImageAspect: 1,
  /** Mowafer imgi_10 mosaic board ~340px tall; short tiles half of that */
  mosaicTallMin: 340,
  mosaicShortMin: 164,
} as const

/**
 * Mowafer type scale (Montserrat).
 * Floor is 14px (sm) — never use text-xs / 10–12px in UI.
 *
 *   sm   14  body secondary, chips, meta
 *   base 16  body primary
 *   lg   18  card titles, emphasis
 *   xl   20  section titles (mobile)
 *   2xl  24  section titles
 *   3xl  30  band headlines
 */
export const typography = {
  fontFamily: '"Montserrat", ui-sans-serif, system-ui, sans-serif',
  fontFamilyAr: '"Cairo", ui-sans-serif, system-ui, sans-serif',
  /** Tailwind class names — use these instead of inventing sizes */
  sm: "text-sm", // 14px
  base: "text-base", // 16px
  lg: "text-lg", // 18px
  xl: "text-xl", // 20px
  "2xl": "text-2xl", // 24px
  "3xl": "text-3xl", // 30px
  /** Semantic roles */
  sectionTitle: "text-xl font-extrabold tracking-tight sm:text-2xl",
  bandTitle: "text-xl font-extrabold tracking-tight sm:text-2xl",
  body: "text-sm leading-relaxed text-muted-foreground sm:text-base",
  label: "text-sm font-semibold",
  meta: "text-sm font-medium text-muted-foreground",
  button: "text-sm font-bold",
} as const

/**
 * Mosaic tile accent from category name/handle.
 * Order matters — more specific first.
 */
export function categoryAccent(
  name: string,
  handle?: string | null,
): string {
  const k = `${name} ${handle ?? ""}`.toLowerCase()
  if (/phone|electron|tech|comput|gadget|laptop|device/.test(k))
    return color.catElectronics
  if (/food|groc|agricult|oil|rice|kitchen|cook|spice/.test(k))
    return color.catFood
  if (/pet|animal|dog|cat\b/.test(k)) return color.catPet
  if (/beauty|personal|cosmetic|skin|makeup|hygiene/.test(k))
    return color.catCosmetics
  if (/bever|drink|water|juice|soda/.test(k)) return color.catBeverages
  if (/health|pharma|medic|wellness|drug/.test(k)) return color.catHealth
  if (/fashion|apparel|cloth|wear|dress|shirt/.test(k)) return color.catFashion
  if (/home|living|furni|decor|lamp/.test(k)) return color.catHome
  if (/baby|kid|child|infant|toddler/.test(k)) return color.catBaby
  return color.catDefault
}

/**
 * Text/icon color on a mosaic accent background.
 * Mowafer imgi_10 uses white type on all four category tiles (incl. yellow/pink).
 */
export function onAccent(bg: string): string {
  const lights = new Set<string>([
    color.catBaby,
    color.primary,
  ])
  if (lights.has(bg)) return color.primaryForeground
  return color.white
}
