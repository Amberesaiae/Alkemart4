/**
 * Governed department themes (blueprint Phase 1E / Doc 02).
 *
 * Single source for department accent families. Top-level departments own a
 * stable colour family; descendants inherit. Colour is strongest in
 * navigation, hero art, filter headings, and selected controls — product
 * cards stay neutral. Every accent/ink pair must pass WCAG AA (4.5:1);
 * see `passesContrast` and the storefront theme test.
 */

export type DepartmentTheme = {
  departmentId: string
  label: string
  /** Primary accent (nav markers, selected controls, badges). */
  accent: string
  /** Tinted wash for hero bands and section grounds. */
  accentSoft: string
  /** Text/icon colour guaranteed legible on `accent`. */
  accentInk: string
  /** Icon key for the department glyph. */
  icon: string
  /** Optional governed category profile for comparable facts/filters. */
  defaultAttributeProfileId?: string
}

export const DEPARTMENT_THEMES: readonly DepartmentTheme[] = [
  { departmentId: "phones-tablets", label: "Phones & Tablets", accent: "#0E7C86", accentSoft: "#E6F4F5", accentInk: "#FFFFFF", icon: "phone" },
  { departmentId: "computing", label: "Computing", accent: "#1D4ED8", accentSoft: "#E8EEFC", accentInk: "#FFFFFF", icon: "laptop" },
  { departmentId: "electronics", label: "Electronics", accent: "#0E7C86", accentSoft: "#E6F4F5", accentInk: "#FFFFFF", icon: "plug" },
  { departmentId: "home-appliances", label: "Home & Appliances", accent: "#B42318", accentSoft: "#FDECEA", accentInk: "#FFFFFF", icon: "home" },
  { departmentId: "fashion", label: "Fashion", accent: "#6D28D9", accentSoft: "#F0EAFB", accentInk: "#FFFFFF", icon: "shirt" },
  { departmentId: "beauty", label: "Beauty & Personal Care", accent: "#A21CAF", accentSoft: "#F9E8FA", accentInk: "#FFFFFF", icon: "sparkle" },
  { departmentId: "groceries", label: "Groceries & Household", accent: "#166534", accentSoft: "#E7F3EA", accentInk: "#FFFFFF", icon: "basket" },
  { departmentId: "baby-kids", label: "Baby & Kids", accent: "#1D4ED8", accentSoft: "#E8EEFC", accentInk: "#FFFFFF", icon: "baby" },
  { departmentId: "sports", label: "Sports & Fitness", accent: "#9A3412", accentSoft: "#FBEFE6", accentInk: "#FFFFFF", icon: "ball" },
  { departmentId: "automotive", label: "Automotive Accessories", accent: "#44403C", accentSoft: "#EDECEA", accentInk: "#FFFFFF", icon: "car" },
  { departmentId: "agriculture", label: "Agriculture Supplies", accent: "#3F6212", accentSoft: "#EFF4E2", accentInk: "#FFFFFF", icon: "leaf" },
  { departmentId: "tools-industrial", label: "Tools, Industrial & Safety", accent: "#92400E", accentSoft: "#FAF0E2", accentInk: "#FFFFFF", icon: "wrench" },
  { departmentId: "pet-care", label: "Pet Care", accent: "#9D174D", accentSoft: "#FBE9F1", accentInk: "#FFFFFF", icon: "paw" },
]

const BY_ID = new Map(DEPARTMENT_THEMES.map((t) => [t.departmentId, t]))

export function departmentTheme(departmentId: string): DepartmentTheme | null {
  return BY_ID.get(departmentId) ?? null
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** True when the theme's ink-on-accent pair meets WCAG AA for text. */
export function passesContrast(theme: DepartmentTheme): boolean {
  return contrastRatio(theme.accentInk, theme.accent) >= 4.5
}
