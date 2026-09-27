/**
 * Department presentation — the one map from an API category to its tile
 * colour, glyph and art. Category names always come from the API; this file
 * only decides how a department *looks*.
 *
 * Art contract (see docs/CODEX-ASSETS.md):
 *   /images/departments/{id}.webp      transparent cut-out, product group,
 *                                      subject bottom-right, ≥1200×900
 *   fallbackPhoto                      existing full-bleed photo, used until
 *                                      the cut-out ships (cover + scrim)
 * The tile tries the cut-out first and falls back without a code change.
 */
import { categoryArtFor } from "@alkemart/shared/category-art"

export type DepartmentId =
  | "electronics"
  | "fashion"
  | "home"
  | "beauty"
  | "gaming"
  | "appliances"
  | "baby"
  | "food"
  | "health"
  | "pets"
  | "sports"
  | "auto"
  | "books"
  | "default"

export type Department = {
  id: DepartmentId
  /** CSS colour (a token var) for the tile ground. */
  ground: string
  /** Text tone that passes contrast on `ground`. */
  tone: "light" | "dark"
  /** Short selling line under the name, when the API gives none. */
  tagline: string
  cutout: string
  fallbackPhoto: string | null
}

const D = (
  id: DepartmentId,
  tone: Department["tone"],
  tagline: string,
): Omit<Department, "fallbackPhoto"> => ({
  id,
  ground: `var(--dept-${id})`,
  tone,
  tagline,
  cutout: `/images/departments/${id}.webp`,
})

const BASE: Record<DepartmentId, Omit<Department, "fallbackPhoto">> = {
  electronics: D("electronics", "light", "Upgrade your world."),
  fashion: D("fashion", "light", "Express your style."),
  home: D("home", "light", "Make home easier."),
  beauty: D("beauty", "light", "Look and feel good."),
  gaming: D("gaming", "light", "Play without limits."),
  appliances: D("appliances", "dark", "For a smarter home."),
  baby: D("baby", "dark", "Pick something lovely for little ones."),
  food: D("food", "light", "Shop fresh and pantry-ready."),
  health: D("health", "dark", "Find everyday wellness essentials."),
  pets: D("pets", "dark", "Treat your best friend well."),
  sports: D("sports", "dark", "Get ready to move."),
  auto: D("auto", "light", "Find gear for the road."),
  books: D("books", "light", "Find your next good read."),
  default: D("default", "dark", "Explore great local finds."),
}

/** Order the rules so specific words win over broad ones ("baby food" → baby). */
const RULES: [RegExp, DepartmentId][] = [
  [/gam(e|ing)|console|playstation|xbox/, "gaming"],
  [/applian|kitchen\b|blender|fridge|cooker/, "appliances"],
  [/baby|kid|child|infant|toddler|toy/, "baby"],
  [/pet|animal|\bdog|\bcat\b/, "pets"],
  [/phone|electron|tech|comput|gadget|laptop|device|audio/, "electronics"],
  [/fashion|apparel|cloth|wear|shoe|sneaker|bag/, "fashion"],
  [/beauty|cosmetic|skin|makeup|fragrance|personal/, "beauty"],
  [/health|pharma|medic|wellness/, "health"],
  [/food|groc|bever|drink|agric|fresh/, "food"],
  [/home|living|furni|decor/, "home"],
  [/sport|outdoor|fitness/, "sports"],
  [/auto|car\b|motor|vehicle/, "auto"],
  [/book|station|office/, "books"],
]

export function departmentFor(handle?: string | null, name?: string | null): Department {
  const key = `${handle ?? ""} ${name ?? ""}`.toLowerCase()
  const id = RULES.find(([re]) => re.test(key))?.[1] ?? "default"
  return { ...BASE[id], fallbackPhoto: categoryArtFor(handle)?.photo ?? null }
}
