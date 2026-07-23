interface ExpressDeliveryBandProps {
  headline?: string;
  subtext?: string;
}

/**
 * Delivery honesty band — Accra/Ghana market, not US warehouse “express” hype.
 * No empty image slot — two-column trust layout only.
 */
export function ExpressDeliveryBand({
  headline = "Delivery across Ghana",
  subtext = "See available options for your address at checkout — we never invent same-day promises.",
}: ExpressDeliveryBandProps) {
  return (
    <div className="grid items-stretch gap-0 overflow-hidden rounded-2xl border border-border bg-secondary text-foreground md:grid-cols-[minmax(220px,280px)_1fr]">
      <div className="flex items-center justify-center bg-card p-8">
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-primary-foreground" aria-hidden="true">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
          </div>
          <div className="mt-3 font-display text-3xl font-bold text-foreground">
            Deliver
            <br />
            in Ghana
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center md:items-start md:text-left">
        <h2 className="font-display text-3xl font-bold md:text-4xl">{headline}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{subtext}</p>
      </div>
    </div>
  );
}
