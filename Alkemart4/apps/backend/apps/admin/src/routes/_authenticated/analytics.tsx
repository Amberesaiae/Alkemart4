import { createFileRoute } from "@tanstack/react-router"
import { useId } from "react"
import { useStats } from "../../hooks/use-stats"
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { ShoppingCart, DollarSign, Store, Package } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { currencySymbol } from "../../lib/config"

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
})

function StatCard({ title, value, icon: Icon }: { title: string; value: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function AnalyticsPage() {
  const { data: stats, isLoading, isFetching, error, dataUpdatedAt } = useStats()
  const gradientId = useId()

  if (isLoading) {
    return (
      <PageShell>
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><Skeleton className="h-32 w-full" /></Card>
          ))}
        </div>
        <Card><Skeleton className="h-[400px] w-full" /></Card>
      </PageShell>
    )
  }

  if (error || !stats) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          Failed to load platform stats.
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between">
        <PageHeader title="Platform Analytics" description="Live marketplace totals — orders, sales value, sellers, and catalog." />
        {dataUpdatedAt != null && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap pb-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
            Last updated: {Math.round((Date.now() - dataUpdatedAt) / 60000)}m ago
          </div>
        )}
      </div>
      {isFetching && <div className="text-xs text-muted-foreground text-right -mt-2 mb-2">Refreshing…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Orders" value={(stats.total_orders ?? 0).toLocaleString()} icon={ShoppingCart} />
        <StatCard title="Total GMV" value={`${currencySymbol}${(stats.total_gmv_ghs ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={DollarSign} />
        <StatCard title="Active Sellers" value={(stats.active_sellers ?? 0).toLocaleString()} icon={Store} />
        <StatCard title="Catalog Size" value={(stats.catalog_size ?? 0).toLocaleString()} icon={Package} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Revenue (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.gmv_last_30_days && stats.gmv_last_30_days.length > 0 ? (
            <div className="h-[400px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.gmv_last_30_days}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    tickFormatter={(val) => `${currencySymbol}${(val ?? 0).toLocaleString()}`}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }}
                    labelFormatter={(val) => new Date(String(val)).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    formatter={(val: any) => [`${currencySymbol}${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill={`url(#${gradientId})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground bg-muted/20 rounded-md border border-dashed mt-4">
              No revenue data available for the last 30 days
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
