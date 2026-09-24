import type { AttributeDefinitionDto } from "../catalog-repository"
import type { WorkersAiLike } from "../env"

/**
 * Draft typed attribute values from what a seller already typed.
 *
 * Why this exists: the filter system reads `product_attribute_values`, and
 * those are only useful if they get filled in. Asking a seller on a phone to
 * complete fifteen structured fields is the reason marketplace facets are
 * usually empty. This turns a title and a sentence into a *draft* the seller
 * confirms.
 *
 * Three rules it never breaks:
 *  - Output is a suggestion. Nothing here writes; the caller returns it for
 *    review and the seller's PUT is still the only way values are stored.
 *  - Model output is untrusted input. Every field is validated against the
 *    definition's type and allowedValues, and anything that does not match is
 *    dropped rather than coerced.
 *  - A definition the model did not answer stays absent. An invented value is
 *    worse than a blank field, because a wrong facet silently hides a product
 *    from the buyers searching for it.
 */

export const SUGGEST_MODEL = "@cf/meta/llama-3.1-8b-instruct"

export type AttributeSuggestion = {
  definitionId: string
  code: string
  label: string
  textValue?: string
  numberValue?: number
  booleanValue?: boolean
  optionValues?: string[]
}

function promptFor(
  defs: AttributeDefinitionDto[],
  product: { title: string; description?: string | null },
): string {
  const spec = defs
    .map((d) => {
      const allowed = d.allowedValues?.length
        ? ` allowed: ${d.allowedValues.join(" | ")}`
        : ""
      return `- ${d.code} (${d.type})${allowed}`
    })
    .join("\n")
  return [
    "Extract product attributes from the listing below.",
    "Reply with ONLY a JSON object mapping attribute code to value.",
    "Omit any attribute you cannot determine from the text. Never guess.",
    "For option types the value must be exactly one of the allowed values.",
    "",
    "Attributes:",
    spec,
    "",
    `Title: ${product.title}`,
    product.description ? `Description: ${product.description}` : "",
    "",
    "JSON:",
  ]
    .filter(Boolean)
    .join("\n")
}

/** First JSON object in the reply; models like to wrap it in prose or fences. */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Keep only values that satisfy their definition. Everything else is dropped. */
export function validateSuggestions(
  defs: AttributeDefinitionDto[],
  raw: Record<string, unknown>,
): AttributeSuggestion[] {
  const out: AttributeSuggestion[] = []
  const byCode = new Map(defs.map((d) => [d.code.toLowerCase(), d]))

  for (const [code, value] of Object.entries(raw)) {
    const def = byCode.get(code.trim().toLowerCase())
    if (!def || value === null || value === undefined || value === "") continue
    const base = { definitionId: def.id, code: def.code, label: def.label }

    if (def.type === "number") {
      let n: number
      if (typeof value === "number") {
        n = value
      } else {
        // Must contain an actual digit. Stripping non-numerics from "loads"
        // leaves "", and Number("") is 0 — silently turning junk into a real
        // facet value, which is the failure mode this whole file exists to
        // avoid.
        const digits = String(value).match(/-?\d+(\.\d+)?/)
        if (!digits) continue
        n = Number(digits[0])
      }
      if (Number.isFinite(n)) out.push({ ...base, numberValue: n })
      continue
    }
    if (def.type === "boolean") {
      if (typeof value === "boolean") out.push({ ...base, booleanValue: value })
      else if (/^(true|yes)$/i.test(String(value))) out.push({ ...base, booleanValue: true })
      else if (/^(false|no)$/i.test(String(value))) out.push({ ...base, booleanValue: false })
      continue
    }
    if (def.type === "option" || def.type === "multi_option") {
      const allowed = def.allowedValues ?? []
      if (allowed.length === 0) continue
      const wanted = (Array.isArray(value) ? value : [value]).map((v) => String(v).trim())
      // Case-insensitive match, but store the definition's own spelling so
      // facet values never fragment into "Lenovo" and "lenovo".
      const matched = wanted
        .map((w) => allowed.find((a) => a.toLowerCase() === w.toLowerCase()))
        .filter((a): a is string => Boolean(a))
      if (matched.length === 0) continue
      out.push({ ...base, optionValues: def.type === "option" ? [matched[0]] : [...new Set(matched)] })
      continue
    }
    const text = String(value).trim().slice(0, 200)
    if (text) out.push({ ...base, textValue: text })
  }
  return out
}

export async function suggestAttributes(
  ai: WorkersAiLike,
  defs: AttributeDefinitionDto[],
  product: { title: string; description?: string | null },
): Promise<AttributeSuggestion[]> {
  if (defs.length === 0) return []
  const result = await ai.run(SUGGEST_MODEL, {
    messages: [
      { role: "system", content: "You extract structured product data. You reply with JSON only." },
      { role: "user", content: promptFor(defs, product) },
    ],
    max_tokens: 512,
  })
  const text = typeof result === "string" ? result : (result.response ?? "")
  const json = extractJsonObject(text)
  return json ? validateSuggestions(defs, json) : []
}
