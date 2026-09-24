import { useState } from "react"

/**
 * Accessible sales chart for low-end phones and low data-literacy sellers.
 *
 * Why bars, one metric at a time (never dual-axis lines):
 * - Bars encode "taller = better day" with zero chart literacy; lines ask
 *   readers to decode slopes and dual axes correctly.
 * - Static SVG: no dependency, ~2KB, no animation to jank on 2GB-RAM phones
 *   or drain battery, crisp at any DPI, renders on first paint over 3G.
 * - Touch-first: nothing hides behind hover. The best bar carries its value;
 *   the axis carries the rest. Metric switches by tapping Revenue | Orders.
 * - Screen readers get role="img" + a plain-language summary + a
 *   visually-hidden data table (every value, no decoding required).
 * - Colour-blind safe: best bar differs by luminance (gold on ink), and every
 *   value also exists as a numeral — colour never carries meaning alone.
 */
export type SalesDay = {
  /** Short weekday label, e.g. "Mon". */
  label: string
  /** Revenue in major units (cedis), may be fractional. */
  revenue: number
  orders: number
}

function maxOf(days: SalesDay[], metric: "revenue" | "orders"): number {
  return days.reduce((m, d) => Math.max(m, metric === "revenue" ? d.revenue : d.orders), 0)
}

function formatTick(value: number, metric: "revenue" | "orders"): string {
  if (metric === "orders") return String(Math.round(value))
  if (value >= 1000) return `GH₵${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return `GH₵${Math.round(value)}`
}

export function SalesBars({ days, caption }: { days: SalesDay[]; caption: string }) {
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue")
  const total = days.reduce((s, d) => s + (metric === "revenue" ? d.revenue : d.orders), 0)
  const max = maxOf(days, metric)
  const bestIndex = days.findIndex(
    (d) => (metric === "revenue" ? d.revenue : d.orders) === max && max > 0,
  )

  const W = 560
  const H = 220
  const padL = 52
  const padB = 28
  const padT = 30
  const innerW = W - padL - 12
  const innerH = H - padT - padB
  const n = Math.max(days.length, 1)
  const slot = innerW / n
  const barW = Math.min(44, Math.max(14, slot * 0.52))
  const ticks = [0, 0.5, 1].map((f) => max * f)
  const summary =
    days.length === 0 || max <= 0
      ? "No sales in the last 7 days."
      : `Total ${metric === "revenue" ? formatTick(total, metric) : `${total} orders`} in the last 7 days. Best day ${days[bestIndex]?.label} with ${formatTick(max, metric)}.`

  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg border border-border/80 p-1 bg-muted/30" role="group" aria-label="Chart metric">
        {(["revenue", "orders"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            aria-pressed={metric === m}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              metric === m ? "bg-card text-foreground shadow-xs border border-border/80" : "text-muted-foreground"
            }`}
          >
            {m === "revenue" ? "Revenue" : "Orders"}
          </button>
        ))}
      </div>
      {days.length === 0 || max <= 0 ? (
        <p className="py-10 text-center text-sm font-medium text-muted-foreground">
          No sales in the last 7 days — new orders will appear here.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Bar chart of ${metric} for the last 7 days. ${summary}`}
        >
          {ticks.map((t, i) => {
            const y = padT + innerH - (max > 0 ? (t / max) * innerH : 0)
            return (
              <g key={i}>
                <line x1={padL} x2={W - 12} y1={y} y2={y} stroke="currentColor" className="text-border" strokeWidth={1} />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={11} className="fill-muted-foreground tabular-nums">
                  {formatTick(t, metric)}
                </text>
              </g>
            )
          })}
          {days.map((d, i) => {
            const v = metric === "revenue" ? d.revenue : d.orders
            const h = max > 0 ? Math.max(2, (v / max) * innerH) : 0
            const x = padL + slot * i + (slot - barW) / 2
            const y = padT + innerH - h
            const isBest = i === bestIndex
            return (
              <g key={d.label + i}>
                {isBest ? (
                  <text x={x + barW / 2} y={y - 8} textAnchor="middle" fontSize={12} fontWeight={800} className="fill-foreground tabular-nums">
                    {formatTick(v, metric)}
                  </text>
                ) : null}
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={4}
                  className={isBest ? "fill-primary" : "fill-foreground"}
                />
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
                  {d.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <table className="sr-only">
        <caption>{`Daily ${metric} for the last 7 days`}</caption>
        <tbody>
          {days.map((d, i) => (
            <tr key={d.label + i}>
              <th scope="row">{d.label}</th>
              <td>{metric === "revenue" ? d.revenue : d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs font-medium text-muted-foreground">{caption}</p>
    </div>
  )
}

/** Bucket orders into the last 7 calendar days (ACCRA weekdays). */
export function bucketLast7Days(
  orders: { created_at?: string | null; total?: number | null }[],
  now = new Date(),
): SalesDay[] {
  const accraDay = (d: Date) =>
    new Intl.DateTimeFormat("en-GH", { timeZone: "Africa/Accra", weekday: "short", day: "numeric", month: "numeric", year: "numeric" }).format(d)
  const days: SalesDay[] = []
  const keys: string[] = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    keys.push(accraDay(d))
    days.push({
      label: new Intl.DateTimeFormat("en-GH", { timeZone: "Africa/Accra", weekday: "narrow" }).format(d),
      revenue: 0,
      orders: 0,
    })
  }
  for (const o of orders) {
    if (!o.created_at) continue
    const t = new Date(o.created_at)
    if (Number.isNaN(t.getTime())) continue
    const k = accraDay(t)
    const idx = keys.indexOf(k)
    if (idx === -1) continue
    days[idx]!.orders += 1
    days[idx]!.revenue += (o.total ?? 0) / 100
  }
  return days
}
