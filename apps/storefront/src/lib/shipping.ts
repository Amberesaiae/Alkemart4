/**
 * Mercur store shipping options may be:
 *   { [seller_id]: ShippingOption[] }
 * Vanilla Medusa: ShippingOption[]
 * Normalize only — never invent option ids.
 */

export type ShippingOption = {
  id: string
  name?: string
  amount?: number
}

export function flattenShippingOptions(raw: unknown): ShippingOption[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.filter(
      (o): o is ShippingOption =>
        Boolean(o && typeof o === "object" && "id" in o && (o as { id: unknown }).id),
    ).map((o) => ({
      id: String((o as { id: string }).id),
      name:
        typeof (o as { name?: string }).name === "string"
          ? (o as { name: string }).name
          : undefined,
      amount:
        (o as { amount?: number }).amount != null
          ? Number((o as { amount: number }).amount)
          : undefined,
    }))
  }
  if (typeof raw === "object") {
    const out: ShippingOption[] = []
    for (const value of Object.values(raw as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        out.push(...flattenShippingOptions(value))
      }
    }
    return out
  }
  return []
}
