export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="type-kicker text-muted-foreground">
      {children}
    </p>
  )
}

/**
 * Product details + specifications matching Jumia PDP layout.
 * Displays Product details card and Specifications card (Key Features, What's in the Box, Specs table).
 */
export function PdpSpecs({
  attributes,
  identity,
  description,
}: {
  attributes: { label: string; value: string }[]
  identity?: {
    brand?: string | null
    model?: string | null
    gtin?: string | null
    mpn?: string | null
    manufacturer?: string | null
    productType?: string | null
  } | null
  description: string | null
}) {
  const idRows: { label: string; value: string }[] = []
  if (identity?.brand) idRows.push({ label: "Brand", value: identity.brand })
  if (identity?.model) idRows.push({ label: "Model", value: identity.model })
  if (identity?.manufacturer) idRows.push({ label: "Manufacturer", value: identity.manufacturer })
  if (identity?.productType) idRows.push({ label: "Product type", value: identity.productType })
  if (identity?.gtin) idRows.push({ label: "GTIN / Barcode", value: identity.gtin })
  if (identity?.mpn) idRows.push({ label: "MPN / Part Number", value: identity.mpn })

  // Extract key features if any attributes start with "feature" or are bullet-style
  const featureAttrs = attributes.filter((a) =>
    /feature|highlight|benefit|function/i.test(a.label),
  )
  const boxAttrs = attributes.filter((a) =>
    /box|included|package|content/i.test(a.label),
  )
  const tableAttrs = attributes.filter(
    (a) => !featureAttrs.includes(a) && !boxAttrs.includes(a),
  )

  const allSpecRows = [...idRows, ...tableAttrs]

  // Fallback key features from description if no explicit feature attributes
  const bulletFeatures: string[] = featureAttrs.map((a) => `${a.label}: ${a.value}`)
  if (bulletFeatures.length === 0 && description) {
    const lines = description
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("•") || l.startsWith("-") || l.startsWith("*"))
      .map((l) => l.replace(/^[•\-*]\s*/, ""))
    if (lines.length > 0) {
      bulletFeatures.push(...lines.slice(0, 6))
    }
  }

  return (
    <div className="space-y-4">
      {/* Product Details Card */}
      {description ? (
        <section
          id="product-details"
          aria-label="Product details"
          className="scroll-mt-24 rounded-lg border border-border/80 bg-card p-4 sm:p-5 shadow-2xs"
        >
          <h2 className="border-b border-border/60 pb-3 text-base font-bold text-foreground">
            Product details
          </h2>
          <div className="pt-3 max-w-none text-xs sm:text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {description}
          </div>
        </section>
      ) : null}

      {/* Specifications Card */}
      {(allSpecRows.length > 0 || bulletFeatures.length > 0) ? (
        <section
          id="specifications"
          aria-label="Specifications"
          className="scroll-mt-24 rounded-lg border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4"
        >
          <h2 className="border-b border-border/60 pb-3 text-base font-bold text-foreground">
            Specifications
          </h2>

          {/* Two Side-by-Side Bordered Boxes: Key Features and What's In The Box */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Box 1: Key Features */}
            <div className="rounded-lg border border-border/80 bg-background/60 p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Key Features
              </h3>
              {bulletFeatures.length > 0 ? (
                <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
                  {bulletFeatures.map((feat, idx) => (
                    <li key={idx} className="leading-snug">{feat}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Quality tested product conforming to industry standards.
                </p>
              )}
            </div>

            {/* Box 2: What's In The Box */}
            <div className="rounded-lg border border-border/80 bg-background/60 p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                What's in the box
              </h3>
              {boxAttrs.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {boxAttrs.map((b, idx) => (
                    <li key={idx} className="leading-snug">
                      {b.label}: {b.value}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  1 x Standard retail packaged item with documentation.
                </p>
              )}
            </div>
          </div>

          {/* Specifications Table */}
          {allSpecRows.length > 0 ? (
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Specifications
              </h3>
              <dl className="overflow-hidden rounded-lg border border-border/80 text-xs">
                {allSpecRows.map((a, i) => (
                  <div
                    key={`${a.label}-${i}`}
                    className={
                      "grid grid-cols-[minmax(0,10rem)_1fr] gap-2 px-3.5 py-2 " +
                      (i % 2 === 0 ? "bg-muted/40" : "bg-card")
                    }
                  >
                    <dt className="font-bold text-muted-foreground">{a.label}:</dt>
                    <dd className="font-medium text-foreground">{a.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
