import type { StoreProductCard } from "@/lib/products"
import { stripHtml } from "@/lib/seo"

/** Details: description (as text, never HTML) + structured facts. */
export function ProductDetails({ product }: { product: StoreProductCard }) {
  const id = product.identity
  const facts: { label: string; value: string }[] = [
    ...(id?.brand ? [{ label: "Brand", value: id.brand }] : []),
    ...(id?.model ? [{ label: "Model", value: id.model }] : []),
    ...(product.attributes ?? []),
    ...(id?.manufacturer ? [{ label: "Manufacturer", value: id.manufacturer }] : []),
    ...(id?.mpn ? [{ label: "Part number", value: id.mpn }] : []),
    ...(id?.gtin ? [{ label: "Barcode (GTIN)", value: id.gtin }] : []),
  ]
  const description = product.description ? stripHtml(product.description).trim() : ""
  if (!description && facts.length === 0) return null
  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      {description ? (
        <div>
          <h3 className="mb-3 text-lg font-bold">About this item</h3>
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{description}</p>
        </div>
      ) : null}
      {facts.length > 0 ? (
        <div>
          <h3 className="mb-3 text-lg font-bold">Specifications</h3>
          <dl className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {facts.map((f) => (
              <div key={`${f.label}:${f.value}`} className="grid grid-cols-[40%_1fr] gap-3 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  )
}
