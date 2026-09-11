/**
 * Pure variant-matrix helpers: option specs in, combos out. No I/O, so the
 * vendor API and unit tests share the exact derivation rules.
 *
 * Caps (per the variants plan): at most 2 option types, at most 30 combos.
 * Vendors with richer catalogs split into separate products instead of
 * fighting decision paralysis on one PDP.
 */
export const MAX_OPTION_TYPES = 2
export const MAX_COMBOS = 30
export const MAX_OPTION_NAME = 40
export const MAX_OPTION_VALUE = 40
export const MAX_VALUES_PER_OPTION = 20

export type OptionSpec = {
  name: string
  values: string[]
}

export class InvalidVariantMatrixError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidVariantMatrixError"
  }
}

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ")
}

/** Normalize + validate specs. Returns deduped specs or throws. */
export function normalizeOptionSpecs(specs: OptionSpec[]): OptionSpec[] {
  if (specs.length > MAX_OPTION_TYPES) {
    throw new InvalidVariantMatrixError(`at most ${MAX_OPTION_TYPES} option types (e.g. Size + Colour)`)
  }
  const seen = new Set<string>()
  const out: OptionSpec[] = []
  for (const spec of specs) {
    const name = cleanName(spec.name)
    if (!name) throw new InvalidVariantMatrixError("option name is required")
    if (name.length > MAX_OPTION_NAME) {
      throw new InvalidVariantMatrixError(`option name "${name}" exceeds ${MAX_OPTION_NAME} characters`)
    }
    const key = name.toLowerCase()
    if (seen.has(key)) throw new InvalidVariantMatrixError(`duplicate option "${name}"`)
    seen.add(key)
    const values: string[] = []
    const seenValues = new Set<string>()
    for (const raw of spec.values) {
      const value = cleanName(raw)
      if (!value) continue
      if (value.length > MAX_OPTION_VALUE) {
        throw new InvalidVariantMatrixError(`option value "${value}" exceeds ${MAX_OPTION_VALUE} characters`)
      }
      const vkey = value.toLowerCase()
      if (seenValues.has(vkey)) continue
      seenValues.add(vkey)
      values.push(value)
    }
    if (values.length === 0) throw new InvalidVariantMatrixError(`option "${name}" needs at least one value`)
    if (values.length > MAX_VALUES_PER_OPTION) {
      throw new InvalidVariantMatrixError(`option "${name}" exceeds ${MAX_VALUES_PER_OPTION} values`)
    }
    out.push({ name, values })
  }
  const combos = out.reduce((n, s) => n * s.values.length, 1)
  if (out.length > 0 && combos > MAX_COMBOS) {
    throw new InvalidVariantMatrixError(
      `that makes ${combos} combinations (max ${MAX_COMBOS}) — split into separate products`,
    )
  }
  return out
}

/** Cartesian product of normalized specs → one option-map per combo. */
export function buildVariantMatrix(specs: OptionSpec[]): Record<string, string>[] {
  const clean = normalizeOptionSpecs(specs)
  let combos: Record<string, string>[] = [{}]
  for (const spec of clean) {
    const next: Record<string, string>[] = []
    for (const combo of combos) {
      for (const value of spec.values) {
        next.push({ ...combo, [spec.name]: value })
      }
    }
    combos = next
  }
  return combos
}

/** "Red / M" style label following spec order. */
export function comboLabel(options: Record<string, string>, names: string[]): string {
  return names.map((n) => options[n] ?? "").filter(Boolean).join(" / ")
}
