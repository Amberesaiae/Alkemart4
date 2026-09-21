/**
 * Product identity confidence (ADR-002) + typed attribute values (Phase 1C).
 *
 * Confidence ladder: seller_specific → matched → identified.
 * Only reviewed transitions promote; nothing auto-merges.
 * Exact peer-offer comparison renders for identified/matched only.
 */

export type IdentityConfidence = "identified" | "matched" | "seller_specific"

export class IdentityTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IdentityTransitionError"
  }
}

/**
 * Promote a product's identity confidence. `reviewedBy` (admin or confirming
 * seller id) is mandatory — unreviewed similarity signals can only propose
 * match candidates, never promote.
 */
export function promoteIdentityConfidence(
  current: IdentityConfidence,
  next: IdentityConfidence,
  reviewedBy: string | null,
): IdentityConfidence {
  if (next === current) return current
  const rank: Record<IdentityConfidence, number> = {
    seller_specific: 0,
    matched: 1,
    identified: 2,
  }
  if (rank[next] < rank[current]) {
    throw new IdentityTransitionError("identity confidence cannot be demoted silently")
  }
  if (!reviewedBy || !reviewedBy.trim()) {
    throw new IdentityTransitionError("identity promotion requires a reviewer")
  }
  return next
}

/** Exact comparison is earned: only identified/matched products show peers. */
export function canShowComparison(confidence: IdentityConfidence): boolean {
  return confidence === "identified" || confidence === "matched"
}

export type AttributeType = "text" | "number" | "boolean" | "option" | "multi_option"

export type AttributeDefinitionLike = {
  id: string
  code: string
  type: AttributeType
  allowedValues?: string[] | null
  required: boolean
}

export type AttributeValueLike = {
  textValue?: string | null
  numberValue?: number | null
  booleanValue?: boolean | null
  optionValues?: string[] | null
  unit?: string | null
}

export class AttributeValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AttributeValidationError"
  }
}

/**
 * Validate one typed value against its definition. Exactly one value slot
 * must be set, matching the definition type; option values must come from
 * the allowed set (case-insensitive).
 */
export function validateAttributeValue(
  def: AttributeDefinitionLike,
  value: AttributeValueLike,
): void {
  const slots = [
    value.textValue ?? null,
    value.numberValue ?? null,
    value.booleanValue ?? null,
    value.optionValues ?? null,
  ]
  const setCount = slots.filter((s) => s !== null).length
  if (setCount !== 1) {
    throw new AttributeValidationError(
      `attribute ${def.code}: exactly one value slot must be set`,
    )
  }
  switch (def.type) {
    case "text":
      if (value.textValue == null || !value.textValue.trim()) {
        throw new AttributeValidationError(`attribute ${def.code}: text value required`)
      }
      break
    case "number":
      if (value.numberValue == null || !Number.isFinite(value.numberValue)) {
        throw new AttributeValidationError(`attribute ${def.code}: finite number required`)
      }
      break
    case "boolean":
      if (value.booleanValue == null) {
        throw new AttributeValidationError(`attribute ${def.code}: boolean required`)
      }
      break
    case "option":
    case "multi_option": {
      const selected = value.optionValues ?? []
      if (selected.length === 0) {
        throw new AttributeValidationError(`attribute ${def.code}: at least one option required`)
      }
      if (def.type === "option" && selected.length !== 1) {
        throw new AttributeValidationError(`attribute ${def.code}: single option only`)
      }
      const allowed = new Set((def.allowedValues ?? []).map((v) => v.toLowerCase()))
      for (const s of selected) {
        if (!allowed.has(s.toLowerCase())) {
          throw new AttributeValidationError(
            `attribute ${def.code}: option "${s}" is not allowed`,
          )
        }
      }
      break
    }
  }
}
