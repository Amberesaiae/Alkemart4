import { Button } from "@workspace/console-ui/components/button"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { monthLabel, type Statement } from "@workspace/console-ui/lib/business"
import { formatMinor } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"

const dateText = (iso: string) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso))

/**
 * One month's statement as a document: totals, every line, and the
 * fingerprint that proves it wasn't edited. Prints cleanly (the console
 * chrome hides in print) and downloads as CSV through `onDownload`.
 */
export function StatementView({
  statement,
  title,
  names,
  onDownload,
  downloading,
}: {
  statement: Statement
  /** Shop name, or "alkemart (platform)". */
  title: string
  /** Seller names for platform statements. */
  names?: Map<string, string>
  onDownload: () => void
  downloading?: boolean
}) {
  const t = statement.data.totals
  const cur = statement.data.currency
  const platform = statement.data.scope === "platform"
  type Row = { label: string; value: string; strong?: boolean }
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: "Sales",
      rows: [
        { label: "Delivered orders", value: String(t.deliveredOrders) },
        { label: "Sales", value: formatMinor(t.salesPesewas, cur), strong: true },
        { label: "Delivery fees", value: formatMinor(t.deliveryFeesPesewas, cur) },
        { label: "Commission", value: formatMinor(t.commissionPesewas, cur) },
      ],
    },
    {
      title: "Money",
      rows: [
        { label: "Earned from online payments", value: formatMinor(t.onlineEarnedPesewas, cur) },
        { label: "Payouts paid", value: formatMinor(t.payoutsPaidPesewas, cur), strong: true },
        { label: "Cash collected on delivery", value: formatMinor(t.cashCollectedPesewas, cur) },
        { label: "Commission owed on cash sales", value: formatMinor(t.cashCommissionOwedPesewas, cur) },
      ],
    },
  ]
  return (
    <article className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Statement · {title}</p>
          <h2 className="text-2xl font-extrabold tracking-tight">{monthLabel(statement.period)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {statement.status === "open"
              ? "This month so far — it's frozen when the month ends."
              : `Closed ${statement.closedAt ? dateText(statement.closedAt) : ""}. It won't change; later corrections appear in a later month.`}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="lg" onClick={onDownload} disabled={downloading}>
            {downloading ? <Spinner /> : null} Download CSV
          </Button>
          <Button variant="outline" size="lg" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </div>
      </header>

      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <h3 className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{g.title}</h3>
            <dl>
              {g.rows.map((r) => (
                <div key={r.label} className="flex justify-between gap-3 border-b py-1.5 text-[15px]">
                  <dt className={cn(r.strong ? "font-semibold" : "text-muted-foreground")}>{r.label}</dt>
                  <dd className={cn("tabular", r.strong && "font-bold")}>{r.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {statement.data.lines.length ? (
        <div className="scroll-quiet overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">What</th>
                {platform ? <th className="py-2 pr-3 font-medium">Shop</th> : null}
                <th className="py-2 pr-3 text-right font-medium">Amount</th>
                <th className="py-2 text-right font-medium">Commission</th>
              </tr>
            </thead>
            <tbody>
              {statement.data.lines.map((l) => (
                <tr key={l.kind + ("orderId" in l ? l.orderId : l.payoutId)} className="border-b last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap tabular">{dateText(l.date)}</td>
                  <td className="py-2 pr-3">
                    {l.kind === "sale"
                      ? `Sale ${l.orderRef}${l.fulfillmentMethod === "pickup" ? " (pickup)" : ""} · ${l.paymentMethod === "cod" ? "cash" : "online"}`
                      : `Payout${l.reference ? ` · ${l.reference}` : ""}`}
                  </td>
                  {platform ? <td className="py-2 pr-3">{names?.get(l.sellerId) ?? "Shop"}</td> : null}
                  <td className="py-2 pr-3 text-right tabular">{formatMinor(l.kind === "sale" ? l.salesPesewas : l.netPesewas, cur)}</td>
                  <td className="py-2 text-right tabular text-muted-foreground">{l.kind === "sale" ? formatMinor(l.commissionPesewas, cur) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing was delivered or paid out this month.</p>
      )}

      {statement.hash ? (
        <footer className="space-y-1 rounded-xl bg-muted p-3 text-xs">
          <p className="font-semibold">
            {statement.verified === false ? "⚠ This statement doesn't match its fingerprint — contact alkemart." : "Fingerprint (SHA-256) — matches the stored statement"}
          </p>
          <p className="font-mono break-all text-muted-foreground">{statement.hash}</p>
        </footer>
      ) : null}
    </article>
  )
}
