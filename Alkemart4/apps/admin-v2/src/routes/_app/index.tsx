import { Link, createFileRoute } from "@tanstack/react-router"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  LegalDocument01Icon,
  PackageIcon,
  PackageSearchIcon,
  ShoppingCart01Icon,
  StarIcon,
  StoreVerified01Icon,
  Tick02Icon,
  ViewIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/console-ui/components/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/console-ui/components/chart"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { PageHeader, SectionTitle } from "@workspace/console-ui/components/console/page-header"
import { StatCard } from "@workspace/console-ui/components/console/stat-card"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { formatMajor } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import type { AdminPath } from "@/lib/nav"
import { useAppeals, useListingsToReview, usePendingReviews, useSellers, useStats, useTraffic } from "@/lib/queries"

export const Route = createFileRoute("/_app/")({ component: OverviewPage })

function OverviewPage() {
  const today = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date())
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={today} title="Overview" description="Work waiting on the team first, then how the marketplace is doing." />
      <AttentionSection />
      <NumbersSection />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <GmvCard />
        <TrafficCard />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <TopProductsCard />
        <TopShopsCard />
      </div>
    </div>
  )
}

type Queue = {
  to: AdminPath
  label: string
  noun: [string, string]
  icon: IconSvgElement
  q: { data?: unknown[]; isPending: boolean; isError: boolean; refetch: () => unknown }
  count: number
}

function AttentionSection() {
  const sellers = useSellers()
  const listings = useListingsToReview()
  const appeals = useAppeals()
  const reviews = usePendingReviews()
  const queues: Queue[] = [
    {
      to: "/sellers",
      label: "Seller applications",
      noun: ["shop waiting", "shops waiting"],
      icon: StoreVerified01Icon,
      q: sellers,
      count: sellers.data?.filter((s) => s.status === "pending_approval").length ?? 0,
    },
    { to: "/listings", label: "Listings to review", noun: ["listing", "listings"], icon: PackageSearchIcon, q: listings, count: listings.data?.length ?? 0 },
    { to: "/appeals", label: "Open appeals", noun: ["appeal", "appeals"], icon: LegalDocument01Icon, q: appeals, count: appeals.data?.length ?? 0 },
    { to: "/buyer-reviews", label: "Reviews to moderate", noun: ["review", "reviews"], icon: StarIcon, q: reviews, count: reviews.data?.length ?? 0 },
  ]
  const total = queues.reduce((n, q) => n + q.count, 0)
  const loading = queues.some((q) => q.q.isPending)
  return (
    <section aria-labelledby="attention-title" className="space-y-3">
      <SectionTitle id="attention-title" title="Needs attention" />
      {!loading && total === 0 && queues.every((q) => !q.q.isError) ? (
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
          <span className="grid size-11 place-items-center rounded-full bg-success-soft text-success">
            <HugeiconsIcon icon={Tick02Icon} className="size-6" aria-hidden />
          </span>
          <p className="font-semibold">All queues are clear.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {queues.map((q) => (
            <li key={q.to}>
              <Link
                to={q.to}
                className={cn(
                  "flex h-full items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/25",
                  q.count > 0 && "border-brand-strong/60",
                )}
              >
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-full",
                    q.count > 0 ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <HugeiconsIcon icon={q.icon} className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-muted-foreground">{q.label}</span>
                  {q.q.isPending ? (
                    <Skeleton className="mt-1 h-7 w-12" />
                  ) : q.q.isError ? (
                    <span className="block text-sm font-semibold text-destructive">Didn't load</span>
                  ) : (
                    <span className="block text-2xl font-extrabold tabular">
                      {q.count}
                      <span className="sr-only"> {q.noun[q.count === 1 ? 0 : 1]}</span>
                    </span>
                  )}
                </span>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NumbersSection() {
  const stats = useStats()
  const s = stats.data
  return (
    <section aria-labelledby="numbers-title" className="space-y-3">
      <SectionTitle id="numbers-title" title="Marketplace" />
      {stats.isError ? (
        <ErrorState title="Marketplace numbers didn't load" error={stats.error} onRetry={() => void stats.refetch()} className="rounded-2xl border bg-card" />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Sales (GMV)" icon={Wallet01Icon} loading={stats.isPending} value={formatMajor(s?.total_gmv_ghs, undefined, { compact: true })} hint="All time, all sellers" />
          <StatCard label="Orders" icon={ShoppingCart01Icon} loading={stats.isPending} value={s?.total_orders.toLocaleString()} hint="All time" />
          <StatCard label="Active sellers" icon={StoreVerified01Icon} loading={stats.isPending} value={s?.active_sellers.toLocaleString()} hint="Shops open for orders" />
          <StatCard label="Products" icon={PackageIcon} loading={stats.isPending} value={s?.catalog_size.toLocaleString()} hint="In the catalogue" />
        </div>
      )}
    </section>
  )
}

const gmvConfig = { amount: { label: "Sales", color: "var(--chart-1)" } } satisfies ChartConfig
const fmtDay = (d: string) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(d))

function GmvCard() {
  const stats = useStats()
  const series = stats.data?.gmv_last_30_days ?? []
  const total = series.reduce((n, p) => n + p.amount, 0)
  const days = series.filter((p) => p.amount > 0).length
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sales, last 30 days</CardTitle>
      </CardHeader>
      <CardContent>
        {stats.isPending ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : stats.isError ? (
          <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
        ) : total === 0 ? (
          <EmptyState icon={Wallet01Icon} title="No sales in the last 30 days" />
        ) : (
          <>
            <p className="mb-3 text-[15px] text-muted-foreground">
              {formatMajor(total)} across {days} day{days === 1 ? "" : "s"} with sales.
            </p>
            <ChartContainer config={gmvConfig} className="h-64 w-full" aria-hidden>
              <BarChart data={series} margin={{ left: 0, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={fmtDay} />
                <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => formatMajor(v, undefined, { compact: true })} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtDay(String(v))} />} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TrafficCard() {
  const q = useTraffic()
  const series = q.data?.series ?? []
  const peak = series.reduce((m, p) => (p.views > m.views ? p : m), { date: "", views: 0 })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Shop views, last 30 days</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <div className="space-y-4">
            <p className="text-4xl font-extrabold tracking-tight tabular">{(q.data?.views30d ?? 0).toLocaleString()}</p>
            <p className="text-[15px] text-muted-foreground">
              {peak.views > 0 ? `Busiest day: ${fmtDay(peak.date)} with ${peak.views.toLocaleString()} views.` : "No shop views recorded yet."}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HugeiconsIcon icon={ViewIcon} className="size-4" aria-hidden />
              Counted when a buyer opens a shop or product page.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TopProductsCard() {
  const stats = useStats()
  const top = (stats.data?.top_products ?? []).slice(0, 5)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top products by sales</CardTitle>
      </CardHeader>
      <CardContent>
        {stats.isPending ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : stats.isError ? (
          <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
        ) : top.length === 0 ? (
          <EmptyState icon={PackageIcon} title="No sales yet" />
        ) : (
          <table className="w-full text-[15px]">
            <caption className="sr-only">Top products by sales</caption>
            <thead>
              <tr className="text-left text-sm text-muted-foreground">
                <th scope="col" className="pb-2 font-medium">Product</th>
                <th scope="col" className="pb-2 text-right font-medium">Units</th>
                <th scope="col" className="pb-2 text-right font-medium">Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {top.map((p) => (
                <tr key={p.title}>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-3">
                      <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-surface">
                        {p.thumbnail ? <img src={p.thumbnail} alt="" className="size-full object-cover" loading="lazy" /> : null}
                      </span>
                      <span className="line-clamp-1">{p.title}</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular">{p.units}</td>
                  <td className="py-2.5 text-right font-semibold tabular">{formatMajor(p.gmv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

function TopShopsCard() {
  const q = useTraffic()
  const top = (q.data?.top_shops ?? []).slice(0, 5)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Most viewed shops</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : top.length === 0 ? (
          <EmptyState icon={StoreVerified01Icon} title="No shop views yet" />
        ) : (
          <ol className="space-y-1">
            {top.map((s, i) => (
              <li key={s.sellerId}>
                <Link to="/sellers" className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-muted">
                  <span className="w-5 text-center text-sm font-bold text-muted-foreground tabular">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span className="text-sm text-muted-foreground tabular">{s.views.toLocaleString()} views</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
