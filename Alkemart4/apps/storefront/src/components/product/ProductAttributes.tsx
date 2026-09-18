import { cn } from "@/lib/utils"

export type ProductAttribute = { label: string; value: string }

/**
 * The product stats line.
 *
 * A dense run of `Label: value` pairs a buyer scans in a second to confirm
 * they are buying the right size of the right thing — not a description
 * paragraph they have to read. Renders nothing at all when the vendor has
 * supplied no facts, rather than an empty "Details" heading over blank space.
 */
export function ProductAttributes({
  attributes,
  variant = "inline",
  className,
}: {
  attributes?: ProductAttribute[]
  /** `inline` for cards and dialogs, `list` for the product page. */
  variant?: "inline" | "list"
  className?: string
}) {
  const rows = (attributes ?? []).filter((a) => a.label && a.value)
  if (rows.length === 0) return null

  if (variant === "list") {
    return (
      <dl
        className={cn(
          "grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-2 text-sm",
          className,
        )}
      >
        {rows.map((a) => (
          <div key={a.label} className="contents">
            <dt className="text-muted-foreground">{a.label}</dt>
            <dd className="font-medium text-foreground">{a.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <dl className={cn("text-sm leading-relaxed text-muted-foreground", className)}>
      {rows.map((a, i) => (
        <span key={a.label} className="inline">
          {i > 0 ? <span aria-hidden> · </span> : null}
          <dt className="inline font-semibold text-foreground">{a.label}:</dt>{" "}
          <dd className="inline">{a.value}</dd>
        </span>
      ))}
    </dl>
  )
}
