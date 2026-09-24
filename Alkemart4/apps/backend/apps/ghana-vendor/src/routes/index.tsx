import { createFileRoute, Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useDashboardStats, useOrders, useTasks, useShopTraffic, useHealth } from "../lib/hooks"
import { Card, Button, Badge, cn, Skeleton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@workspace/ui"
import { ArrowRight, Package, TrendUp, ShoppingBag, Clock, PlusCircle, WarningCircle, CheckCircle, ShieldCheck } from "@phosphor-icons/react"
import { format } from "date-fns"
import { PageShell } from "../components/page-shell"
import { PageHeader } from "../components/page-header"

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  const qc = useQueryClient()
  const { data: stats, isLoading: statsLoading, isError: statsError } = useDashboardStats()
  const { data: recentOrders, isLoading: ordersLoading, isError: ordersError } = useOrders({ limit: 5 })
  const { data: tasksData } = useTasks()
  const tasks = tasksData?.tasks ?? []
  const { data: traffic } = useShopTraffic()
  const { data: health } = useHealth()

  // format currency
  const formatGhs = (amount = 0) => 
    new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount)

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Overview" description="Here's what's happening at your stall today." />
        <Link to="/quick-sell">
            <Button size="lg" className="w-full sm:w-auto gap-2 shadow-lg transition-transform">
            <PlusCircle className="h-5 w-5" />
            Quick Sell
          </Button>
        </Link>
      </div>

      {traffic && traffic.views30d > 0 ? (
        <p className="text-sm text-muted-foreground -mt-2" aria-live="polite">
          Last 30 days: <span className="font-bold text-foreground">{traffic.views30d.toLocaleString()} shop views</span>
          {" · "}
          <span className="font-bold text-foreground">{(traffic.conversion * 100).toFixed(1)}% converted</span>
        </p>
      ) : null}

      {stats?.readiness && !stats.readiness.setup_complete && stats.readiness.phase === "setup_incomplete" && (
        <Card className="p-5 border-2 border-warning/30 bg-warning/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-black flex items-center gap-2">
                <WarningCircle className="h-5 w-5 text-warning-fg shrink-0" />
                Finish setting up your shop
              </h2>
              <p className="text-sm text-muted-foreground font-medium mt-1">
                {stats.readiness.next_action?.label || "Complete your shop setup to start selling."}
              </p>
              <ul className="mt-3 space-y-1.5">
                {Object.entries(stats.readiness.checklist || {}).map(([key, done]) => (
                  <li key={key} className="flex items-center gap-2 text-sm font-semibold">
                    {done
                      ? <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      : <WarningCircle className="h-4 w-4 text-warning-fg shrink-0" />}
                    {stats.readiness?.checklist_labels?.[key] ?? key}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              to="/settings"
              search={{ tab: stats.readiness.checklist?.profile ? "dispatch" : "profile" }}
              className="shrink-0"
            >
              <Button className="gap-2">
                Continue setup <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Sales" 
          value={statsLoading ? "" : formatGhs(stats?.gmv_ghs || 0)} 
          icon={TrendUp}
          highlight
          loading={statsLoading}
        />
        <StatCard 
          title="Total Orders" 
          value={statsLoading ? "" : String(stats?.orders_count || 0)} 
          icon={ShoppingBag}
          loading={statsLoading}
        />
        <StatCard 
          title="Active Listings" 
          value={statsLoading ? "" : String(stats?.products_count || 0)} 
          icon={Package}
          loading={statsLoading}
        />
        <StatCard 
          title="Pending Action" 
          value={statsLoading ? "" : String(tasks.length || 0)}
          icon={Clock}
          loading={statsLoading}
        />
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Shop standing
          {health ? (
            <span
              className={
                health.status === "healthy"
                  ? "ml-auto text-xs font-bold uppercase tracking-wide text-success"
                  : health.status === "blocked"
                    ? "ml-auto text-xs font-bold uppercase tracking-wide text-destructive"
                    : "ml-auto text-xs font-bold uppercase tracking-wide text-warning-fg"
              }
            >
              {health.status}
            </span>
          ) : null}
        </h2>
        {!health || health.items.length === 0 ? (
          <p className="text-sm text-muted-foreground font-medium">
            {health ? "Everything looks good — keep it up." : "Checking your standing…"}
          </p>
        ) : (
          <ul className="space-y-2 mt-3">
            {health.items.map((h) => (
              <li key={h.key}>
                <a
                  href={h.href}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors"
                >
                  <WarningCircle
                    className={`h-5 w-5 shrink-0 ${h.state === "blocked" ? "text-destructive" : "text-warning-fg"}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-sm">{h.label}</span>
                    <span className="block text-xs text-muted-foreground truncate">{h.detail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5 text-primary" />
          Needs your attention
        </h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground font-medium">
            All clear — nothing needs you right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.kind}>
                <a
                  href={t.href}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors"
                >
                  <WarningCircle className="h-5 w-5 text-warning-fg shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-sm">{t.title}</span>
                    <span className="block text-xs text-muted-foreground truncate">{t.detail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {ordersError ? (
        <Card className="p-8 text-center border-2 border-destructive/20">
          <WarningCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-bold mb-1">Failed to load orders</h2>
          <p className="text-muted-foreground text-sm mb-4">Something went wrong. Please try again.</p>
          <Button onClick={() => { qc.invalidateQueries({ queryKey: ["vendor"] }) }} variant="outline" className="gap-2">
            Retry
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {statsError && (
            <p className="text-xs text-muted-foreground font-medium">
              Live stats unavailable — showing zeros until the next refresh.
            </p>
          )}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Recent Orders</h2>
            <Link to="/orders">
              <Button variant="ghost" size="sm" className="gap-2 font-bold">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <Card className="overflow-hidden border-2">
            <div className="overflow-x-auto">
              <Table label="Recent orders">
                <caption className="sr-only">Recent orders</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5} className="text-center py-4">
                          <Skeleton className="h-4 w-full max-w-xs mx-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : !recentOrders?.orders || recentOrders.orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <ShoppingBag className="h-10 w-10 mb-3 opacity-20" />
                          <p className="font-semibold text-foreground">No orders yet</p>
                          <p className="text-xs">When customers buy your items, they'll appear here.</p>
      </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentOrders.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-bold text-primary">
                          #{order.display_id ?? order.id.slice(-6)}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-medium">
                          {order.created_at ? format(new Date(order.created_at), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            order.fulfillment_status === "delivered" || order.fulfillment_status === "fulfilled" ? "success" :
                            order.fulfillment_status === "shipped" ? "default" : "warning"
                          }>
                            {order.fulfillment_status === "placed" || order.fulfillment_status === "not_fulfilled"
                              ? "Pending"
                              : order.fulfillment_status || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {formatGhs(order.total ? order.total / 100 : 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to="/orders/$id" params={{ id: order.id }}>
                            <Button variant="outline" size="sm" className="h-8">Details</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </PageShell>
  )
}

function StatCard({ title, value, icon: Icon, highlight = false, loading = false }: { title: string, value: string, icon: React.ComponentType<{ className?: string }>, highlight?: boolean, loading?: boolean }) {
  return (
    <Card className={cn(
      "p-5 flex flex-col gap-4 border-2 transition-colors hover:shadow-md",
      highlight ? "bg-primary text-primary-foreground border-primary" : "bg-card text-card-foreground"
    )}>
      <div className="flex items-center justify-between">
        <p className={cn("text-sm font-bold", highlight ? "text-primary-foreground/80" : "text-muted-foreground")}>{title}</p>
        <div className={cn("p-2 rounded-lg", highlight ? "bg-black/10 text-primary-foreground" : "bg-muted text-foreground")}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
        {loading ? <Skeleton className="h-8 w-20" /> : value}
      </h3>
    </Card>
  )
}