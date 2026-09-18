/**
 * Structured product attributes — the "product stats" line.
 *
 * These are not variants. A variant is what a buyer *chooses* (size, colour);
 * an attribute is what the item *is* (1ltr, glass bottle, Volta Region). Both
 * exist because a buyer confirming "is this the right size of the right
 * thing?" should not have to read a description paragraph to find out.
 *
 * Labels are normalised on write so three vendors typing "weight", "Wt." and
 * "WEIGHT" do not fragment the same fact into three columns.
 */

export type ProductAttribute = {
  label: string
  value: string
}

export const MAX_ATTRIBUTES = 12
export const MAX_ATTRIBUTE_LABEL = 40
export const MAX_ATTRIBUTE_VALUE = 120

/**
 * Suggested labels per top-level department.
 *
 * Suggestions, not a schema: a vendor may add their own, and nothing is
 * rejected for being off-list. They exist so the common facts get the same
 * name across shops, which is what makes them comparable.
 */
export const ATTRIBUTE_SUGGESTIONS: Record<string, string[]> = {
  "food-groceries": ["Weight", "Volume", "Pack size", "Origin", "Storage", "Expiry"],
  "health-beauty": ["Volume", "Skin type", "Scent", "Pack size", "Active ingredient"],
  "phones-electronics": ["Brand", "Model", "Storage", "RAM", "Colour", "Warranty", "Power"],
  "home-living": ["Material", "Dimensions", "Colour", "Capacity", "Care"],
  "fashion-apparel": ["Material", "Fit", "Colour", "Care", "Origin"],
  "baby-kids": ["Age range", "Weight", "Material", "Pack size", "Safety"],
  "pet-care": ["Weight", "Animal", "Life stage", "Flavour"],
}

/** Title Case, collapsed whitespace, no trailing colon. */
export function normalizeAttributeLabel(raw: string): string {
  const cleaned = raw
    .replace(/[:\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned) return ""
  return cleaned
    .split(" ")
    .map((word) =>
      // Keep deliberate capitalisation like "RAM" or "SKU" rather than
      // flattening acronyms the vendor typed on purpose.
      word === word.toUpperCase() && word.length <= 4
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ")
}

export type AttributeParseResult =
  | { ok: true; attributes: ProductAttribute[] }
  | { ok: false; error: string }

/**
 * Validate and normalise a vendor-supplied attribute list.
 *
 * Empty rows are dropped rather than rejected — a form with blank spare rows
 * is normal, and failing the whole save over one is hostile. Duplicate labels
 * *are* rejected, because two rows called "Weight" is a mistake the vendor
 * needs to see, not something to silently pick a winner for.
 */
export function parseProductAttributes(input: unknown): AttributeParseResult {
  if (input == null) return { ok: true, attributes: [] }
  if (!Array.isArray(input)) return { ok: false, error: "attributes must be a list" }

  const out: ProductAttribute[] = []
  const seen = new Set<string>()

  for (const row of input) {
    if (row == null || typeof row !== "object") {
      return { ok: false, error: "each attribute must have a label and a value" }
    }
    const r = row as { label?: unknown; value?: unknown }
    if (typeof r.label !== "string" || typeof r.value !== "string") {
      return { ok: false, error: "each attribute must have a label and a value" }
    }
    const label = normalizeAttributeLabel(r.label)
    const value = r.value.replace(/\s+/g, " ").trim()
    if (!label && !value) continue
    if (!label) return { ok: false, error: "an attribute value needs a label" }
    if (!value) return { ok: false, error: `“${label}” needs a value` }
    if (label.length > MAX_ATTRIBUTE_LABEL) {
      return { ok: false, error: `attribute labels must be ${MAX_ATTRIBUTE_LABEL} characters or fewer` }
    }
    if (value.length > MAX_ATTRIBUTE_VALUE) {
      return { ok: false, error: `“${label}” must be ${MAX_ATTRIBUTE_VALUE} characters or fewer` }
    }
    const key = label.toLowerCase()
    if (seen.has(key)) return { ok: false, error: `“${label}” is listed twice` }
    seen.add(key)
    out.push({ label, value })
  }

  if (out.length > MAX_ATTRIBUTES) {
    return { ok: false, error: `at most ${MAX_ATTRIBUTES} attributes` }
  }
  return { ok: true, attributes: out }
}

/** Read attributes back off a stored JSON column, discarding anything malformed. */
export function attributesFromJson(raw: unknown): ProductAttribute[] {
  const parsed = parseProductAttributes(raw)
  return parsed.ok ? parsed.attributes : []
}
