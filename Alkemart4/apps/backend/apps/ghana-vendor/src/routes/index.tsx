import { createFileRoute, Link } from "@tanstack/react-router"
import { useDashboardStats, useOrders } from "../lib/hooks"
import { Card, Button, Badge, cn } from "../components/ui"
import { ArrowRight, Package, TrendingUp, ShoppingBag, Clock, PlusCircle } from "lucide-react"
import { format } from "date-fns"

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: recentOrders, isLoading: ordersLoading } = useOrders({ limit: 5 })

  // format currency
  const formatGhs = (amount = 0) => 
    new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount)

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Overview</h1>
          <p className="text-muted-foreground font-medium">Here's what's happening at your stall today.</p>
        </div>
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
          value={statsLoading ? "..." : formatGhs(stats?.gmv_ghs || 0)} 
          icon={TrendingUp}
          highlight
        />
        <StatCard 
          title="Total Orders" 
          value={statsLoading ? "..." : String(stats?.orders_count || 0)} 
          icon={ShoppingBag}
        />
        <StatCard 
          title="Active Listings" 
          value={statsLoading ? "..." : String(stats?.products_count || 0)} 
          icon={Package}
        />
        <StatCard 
          title="Pending Action" 
          value={statsLoading ? "..." : "0"} // using placeholder if we don't have exactly pending count
          icon={Clock}
        />
      </div>

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
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 border-b-2 border-border font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {ordersLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground font-medium animate-pulse">Loading orders...</td>
                  </tr>
                ) : !recentOrders?.orders || recentOrders.orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <ShoppingBag className="h-10 w-10 mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">No orders yet</p>
                        <p className="text-xs">When customers buy your items, they'll appear here.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentOrders.orders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4 font-bold text-primary">#{order.display_id}</td>
                      <td className="px-4 py-4 text-muted-foreground font-medium">
                        {order.created_at ? format(new Date(order.created_at), "MMM d, yyyy") : "-"}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={
                          order.fulfillment_status === "fulfilled" ? "success" : 
                          order.fulfillment_status === "shipped" ? "default" : "warning"
                        }>
                          {order.fulfillment_status || "Pending"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right font-bold">
                        {formatGhs(order.total ? order.total / 100 : 0)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link to="/orders/$id" params={{ id: order.id }}>
                          <Button variant="outline" size="sm" className="h-8">Details</Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, highlight = false }: { title: string, value: string, icon: any, highlight?: boolean }) {
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
      <h3 className="text-2xl sm:text-3xl font-black tracking-tight">{value}</h3>
    </Card>
  )
}