/**
 * Occasion/holiday theme presets for homepage bento & hero sections. Admins
 * pick a preset (or "custom") from the homepage editor; the resulting colors
 * are stored in the section's `config.theme` / `config.customBg` /
 * `config.customFg` fields and consumed by BentoCard/HeroSplit.
 */
export const HOMEPAGE_THEME_PRESETS = [
  { value: "default", label: "Default", bg: undefined, fg: undefined },
  { value: "holiday", label: "Holiday", bg: "#8B1E2B", fg: "#FDF6EC" },
  { value: "sale", label: "Sale / Clearance", bg: "#DAA520", fg: "#151515" },
  { value: "summer", label: "Summer", bg: "#2E6E75", fg: "#F5F5F5" },
  { value: "custom", label: "Custom colors", bg: undefined, fg: undefined },
] as const;

export type HomepageThemePreset = (typeof HOMEPAGE_THEME_PRESETS)[number]["value"];

export function resolveThemeColors(
  theme: string | undefined,
  customBg: string | undefined,
  customFg: string | undefined,
): { bg?: string; fg?: string } {
  if (theme === "custom") {
    return { bg: customBg, fg: customFg };
  }
  const preset = HOMEPAGE_THEME_PRESETS.find((p) => p.value === theme);
  return { bg: preset?.bg, fg: preset?.fg };
}
