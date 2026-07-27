import { createFileRoute, Link } from "@tanstack/react-router"
import { useDashboardStats, useOrders } from "../lib/hooks"
import { Card, Button, Badge, cn, Skeleton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@workspace/ui"
import { ArrowRight, Package, TrendingUp, ShoppingBag, Clock, PlusCircle, AlertCircle, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { PageShell } from "../components/page-shell"
import { PageHeader } from "../components/page-header"

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useDashboardStats()
  const { data: recentOrders, isLoading: ordersLoading, isError: ordersError } = useOrders({ limit: 5 })

  // format currency
  const formatGhs = (amount = 0) => 
    new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount)

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Overview" description="Here's what's happening at your stall today." />
        <Link to="/quick-sell">
          <Button size="lg" className="w-full sm:w-auto gap-2 shadow-lg hover:scale-[1.02] transition-transform">
            <PlusCircle className="h-5 w-5" />
            Quick Sell
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Sales" 
          value={statsLoading ? "" : formatGhs(stats?.gmv_ghs || 0)} 
          icon={TrendingUp}
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
          value={statsLoading ? "" : "0"}
          icon={Clock}
          loading={statsLoading}
        />
      </div>

      {statsError || ordersError ? (
        <Card className="p-8 text-center border-2 border-destructive/20">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-bold mb-1">Failed to load data</h2>
          <p className="text-muted-foreground text-sm mb-4">Something went wrong. Please try again.</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Action</TableHead>
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
                        <TableCell className="font-bold text-primary">#{order.display_id}</TableCell>
                        <TableCell className="text-muted-foreground font-medium">
                          {order.created_at ? format(new Date(order.created_at), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            order.fulfillment_status === "fulfilled" ? "success" : 
                            order.fulfillment_status === "shipped" ? "default" : "warning"
                          }>
                            {order.fulfillment_status || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">
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
      "p-5 flex flex-col gap-4 border-2 transition-all hover:-translate-y-1 hover:shadow-md",
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