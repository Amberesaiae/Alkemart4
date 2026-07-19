/**
 * Mowafer department themes — class-based (imgi_11 / imgi_12).
 * Components apply a `.theme-dept-*` class; paint via CSS variables.
 * No inline backgroundColor / color styles.
 */

export type DeptThemeId =
  | "electronics"
  | "food"
  | "pet"
  | "beverages"
  | "personal"
  | "baby"
  | "fashion"
  | "home"
  | "default"

const KEYWORD_THEME: { test: RegExp; id: DeptThemeId }[] = [
  { test: /phone|electron|tech|comput|gadget|device/i, id: "electronics" },
  { test: /food|groc|agricult|oil|rice|kitchen|cook/i, id: "food" },
  { test: /pet|animal|\bdog\b|\bcats?\b/i, id: "pet" },
  { test: /bever|drink|water|juice|soda/i, id: "beverages" },
  { test: /beauty|personal|cosmetic|skin|makeup|hygiene|health/i, id: "personal" },
  { test: /baby|kid|child|infant|toddler/i, id: "baby" },
  { test: /fashion|apparel|cloth|wear|dress/i, id: "fashion" },
  { test: /home|living|furni|decor|lamp/i, id: "home" },
]

/** CSS class for department theme root, e.g. `theme-dept-pet`. */
export function deptThemeClass(
  name: string,
  handle?: string | null,
): string {
  return `theme-dept-${deptThemeId(name, handle)}`
}

export function deptThemeId(
  name: string,
  handle?: string | null,
): DeptThemeId {
  const key = `${name} ${handle ?? ""}`
  for (const { test, id } of KEYWORD_THEME) {
    if (test.test(key)) return id
  }
  return "default"
}

/** @deprecated use deptThemeClass + CSS — kept for rare non-class needs */
export type CategoryTheme = {
  bg: string
  fg: string
  soft: string
}

const LEGACY: Record<DeptThemeId, CategoryTheme> = {
  electronics: { bg: "#50D1C8", fg: "#ffffff", soft: "#e6faf8" },
  food: { bg: "#FEBF31", fg: "#3C3C3B", soft: "#fff8e0" },
  pet: { bg: "#F0295A", fg: "#ffffff", soft: "#fde8ee" },
  beverages: { bg: "#9AC63B", fg: "#ffffff", soft: "#f0f8e0" },
  personal: { bg: "#F5A3C7", fg: "#3C3C3B", soft: "#fdeef5" },
  baby: { bg: "#3B82F6", fg: "#ffffff", soft: "#e8f1fe" },
  fashion: { bg: "#7C6CF0", fg: "#ffffff", soft: "#eeecfd" },
  home: { bg: "#F0295A", fg: "#ffffff", soft: "#fde8ee" },
  default: { bg: "#50D1C8", fg: "#ffffff", soft: "#e6faf8" },
}

export function themeForCategory(
  name: string,
  handle?: string | null,
  _index = 0,
): CategoryTheme {
  return LEGACY[deptThemeId(name, handle)]
}

export function categoryGlyph(name: string, handle?: string | null): string {
  const key = `${name} ${handle ?? ""}`.toLowerCase()
  if (/phone|electron|tech/.test(key)) return "▣"
  if (/food|groc|agricult/.test(key)) return "▤"
  if (/fashion|apparel/.test(key)) return "▥"
  if (/home|living/.test(key)) return "▦"
  if (/health|beauty/.test(key)) return "▧"
  if (/baby|kid/.test(key)) return "▨"
  if (/auto/.test(key)) return "▩"
  return "▪"
}
