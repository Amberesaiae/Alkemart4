/**
 * Occasion/holiday theme presets for homepage bento & hero sections. Admins
 * pick a preset (or "custom") from the homepage editor; the resulting colors
 * are stored in the section's `config.theme` / `config.customBg` /
 * `config.customFg` fields and consumed by BentoCard/HeroSplit.
 */
export const HOMEPAGE_THEME_PRESETS = [
  { value: "default", label: "Default", bg: undefined, fg: undefined },
  { value: "holiday", label: "Holiday", bg: "#111111", fg: "#F5C518" },
  { value: "sale", label: "Sale / Clearance", bg: "#F5C518", fg: "#111111" },
  { value: "summer", label: "Summer", bg: "#000000", fg: "#FFFFFF" },
  { value: "dusk", label: "Dusk", bg: "#1A1A1A", fg: "#F5C518" },
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
