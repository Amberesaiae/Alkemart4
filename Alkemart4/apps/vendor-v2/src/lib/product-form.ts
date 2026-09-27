/** Pure helpers for the product form (kept out of component files for fast refresh). */
import type { AttributeField, AttributeValue } from "./products"

export const MAX_OPTIONS = 2
export const MAX_VALUES = 20
export const MAX_COMBOS = 30

export type OptionDef = { name: string; values: string[] }
export type ComboRow = { key: string; options: Record<string, string>; price: string; qty: string; on: boolean }

export const NAME_SUGGESTIONS = ["Size", "Colour", "Storage", "Material", "Weight"]
export const VALUE_SUGGESTIONS: Record<string, string[]> = {
  size: ["S", "M", "L", "XL", "XXL"],
  colour: ["Black", "White", "Red", "Blue", "Green"],
  color: ["Black", "White", "Red", "Blue", "Green"],
  storage: ["64GB", "128GB", "256GB", "512GB"],
  material: ["Cotton", "Leather", "Plastic", "Wood"],
  weight: ["500g", "1kg", "2kg", "5kg"],
}

/** Every combination of the option values, keyed stably ("Size=M|Colour=Red"). */
export function combosOf(options: OptionDef[]): Record<string, string>[] {
  const used = options.filter((o) => o.name.trim() && o.values.length)
  if (!used.length) return []
  return used.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.name.trim()]: v }))), [{}])
}

export const comboKey = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([k, v]) => `${k}=${v}`)
    .join("|")

/** Keep edits for combos that still exist; new combos start at the base price. */
export function syncRows(options: OptionDef[], rows: ComboRow[], basePrice: string, baseQty: string): ComboRow[] {
  const byKey = new Map(rows.map((r) => [r.key, r]))
  return combosOf(options).map((o) => byKey.get(comboKey(o)) ?? { key: comboKey(o), options: o, price: basePrice, qty: baseQty, on: true })
}


export const categoriesKey = ["categories"] as const

/** Words that tell us nothing about the category. */
const STOP = new Set(["the", "and", "for", "with", "new", "used", "brand", "original", "quality", "size", "set", "pack", "of", "a", "in"])

function words(s: string) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
}

/** Leaves whose name/path shares words with the title, best first. */
export function suggestCategories(title: string, leaves: { id: string; name: string; path: string }[], limit = 3) {
  const t = new Set(words(title).flatMap((w) => [w, w.replace(/s$/, "")]))
  if (!t.size) return []
  return leaves
    .map((l) => {
      const ws = words(l.path)
      const score = ws.reduce((n, w) => n + (t.has(w) || t.has(w.replace(/s$/, "")) ? (words(l.name).includes(w) ? 3 : 1) : 0), 0)
      return { l, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.l)
}


export type SpecValues = Record<string, AttributeValue>

export function isAnswered(f: AttributeField, v: AttributeValue | undefined) {
  if (!v) return false
  switch (f.type) {
    case "number":
      return v.numberValue != null && Number.isFinite(v.numberValue)
    case "boolean":
      return v.booleanValue != null
    case "option":
    case "multi_option":
      return Boolean(v.optionValues?.length)
    default:
      return Boolean(v.textValue?.trim())
  }
}

