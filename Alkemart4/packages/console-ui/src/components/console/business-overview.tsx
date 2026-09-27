import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/console-ui/components/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/console-ui/components/chart"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { changeText, type BusinessOverview } from "@workspace/console-ui/lib/business"
import { formatMinor } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"

const chartConfig = { sales: { label: "Sales", color: "var(--brand)" } } satisfies ChartConfig

function Kpi({ label, value, change, hint }: { label: string; value: string; change?: number | null; hint?: string }) {
  const text = change === undefined ? null : changeText(change)
  const up = change != null && change > 0.005
  const down = change != null && change < -0.005
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-3.5 sm:p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {/* Big amounts wrap on small phones instead of spilling out of the card. */}
      <p className="mt-1 text-lg leading-tight font-extrabold tracking-tight tabular [overflow-wrap:anywhere] sm:text-2xl">{value}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {text ? (
          <span className={cn("rounded-full px-1.5 py-0.5 font-bold tabular", up ? "bg-success-soft text-success" : down ? "bg-danger-soft text-destructive" : "bg-muted")}>
            {text}
            <span className="sr-only"> vs the previous period</span>
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </p>
    </div>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/**
 * The business overview for a shop (`audience="seller"`) or the platform
 * (`audience="admin"`). Every number comes from the API; this only lays it out.
 */
export function BusinessOverviewView({ data, audience, loading }: { data: BusinessOverview | undefined; audience: "seller" | "admin"; loading?: boolean }) {
  if (loading || !data) {
    return (
      <div className="space-y-4" aria-busy>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }
  const c = data.current
  const cur = data.currency
  const platform = audience === "admin" && !data.sellerName
  // Minor units straight through: the market decides how they display.
  const series = c.series.map((p) => ({ label: p.label, sales: Number(p.salesPesewas), orders: p.orders }))
  const empty = c.orders === 0 && c.cancelled === 0
  // Only show "vs previous" where an earlier period of the same length means something.
  const cmp = (v: number | null) => (data.comparable ? v : undefined)
  const was = (v: string) => (data.comparable ? `was ${formatMinor(v, cur, { compact: true })}` : undefined)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Sales" value={formatMinor(c.salesPesewas, cur)} change={cmp(data.compare.salesPesewas)} hint={was(data.previousTotals.salesPesewas)} />
        <Kpi label="Orders" value={String(c.orders)} change={cmp(data.compare.orders)} hint={c.cancelled ? `${c.cancelled} cancelled` : undefined} />
        {platform ? (
          <Kpi label="Commission earned" value={formatMinor(c.commissionPesewas, cur)} change={cmp(data.compare.commissionPesewas)} />
        ) : (
          <Kpi label="You keep" value={formatMinor(c.takeHomePesewas, cur)} change={cmp(data.compare.takeHomePesewas)} hint={`after ${formatMinor(c.commissionPesewas, cur, { compact: true })} commission`} />
        )}
        <Kpi label="Average order" value={formatMinor(c.avgOrderPesewas, cur)} change={cmp(data.compare.avgOrderPesewas)} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <CardTitle className="text-base">Sales by {data.range.bucket}</CardTitle>
            <span className="text-sm text-muted-foreground">{data.range.label}</span>
          </div>
        </CardHeader>
        <CardContent>
          {empty ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No orders in this period yet.</p>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={series} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatMinor(Number(v), cur)} />} />
                <Bar dataKey="sales" fill="var(--color-sales)" radius={6} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Buyers" value={String(c.buyers)} change={cmp(data.compare.buyers)} hint={c.repeatBuyers ? `${c.repeatBuyers} came back` : undefined} />
        <Kpi label="Delivered" value={String(c.delivered)} hint={c.orders ? `${pct(c.delivered / c.orders)} of orders` : undefined} />
        <Kpi label="Pay on delivery" value={pct(c.payOnDeliveryShare)} hint="of orders" />
        {platform ? (
          <Kpi label="Active shops" value={String(c.activeSellers)} hint={c.newSellers ? `${c.newSellers} joined` : undefined} />
        ) : (
          <Kpi label="Pickup" value={pct(c.pickupShare)} hint="of orders" />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Ranked
          title="Best sellers"
          empty="Sales show up here."
          rows={c.topProducts.map((p) => ({ key: p.productId, name: p.title, meta: `${p.units} sold`, amount: formatMinor(p.salesPesewas, cur) }))}
        />
        {platform ? (
          <Ranked
            title="Top shops"
            empty="Shops with sales show up here."
            rows={c.sellers.map((s) => ({ key: s.sellerId, name: s.name ?? "Shop", meta: `${s.orders} orders · ${formatMinor(s.commissionPesewas, cur, { compact: true })} commission`, amount: formatMinor(s.salesPesewas, cur) }))}
          />
        ) : (
          <Ranked
            title="Where buyers are"
            empty="Regions show up here."
            rows={c.regions.map((r) => ({ key: r.region, name: r.region, meta: `${r.orders} orders`, amount: formatMinor(r.salesPesewas, cur) }))}
          />
        )}
      </div>
      {platform ? (
        <Ranked
          title="Where buyers are"
          empty="Regions show up here."
          rows={c.regions.map((r) => ({ key: r.region, name: r.region, meta: `${r.orders} orders`, amount: formatMinor(r.salesPesewas, cur) }))}
        />
      ) : null}
    </div>
  )
}

function Ranked({ title, rows, empty }: { title: string; rows: { key: string; name: string; meta: string; amount: string }[]; empty: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ol className="divide-y">
            {rows.slice(0, 8).map((r, i) => (
              <li key={r.key} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span className="w-5 shrink-0 text-sm font-bold text-muted-foreground tabular">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">{r.meta}</span>
                </span>
                <span className="shrink-0 font-semibold tabular">{r.amount}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  )
}
