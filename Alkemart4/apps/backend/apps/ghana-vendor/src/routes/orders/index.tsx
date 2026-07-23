import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { useOrders } from "../../lib/hooks"
import { Card, Badge, Button } from "../../components/ui"
import { format } from "date-fns"
import { Search, Filter, ShoppingBag } from "lucide-react"

export const Route = createFileRoute('/orders/')({
  component: OrdersPage,
})

function OrdersPage() {
  const [filter, setFilter] = useState("all")
  
  const params = filter === "all" ? undefined : 
                 filter === "pending" ? { fulfillment_status: "not_fulfilled" } :
                 filter === "shipped" ? { fulfillment_status: "shipped" } :
                 { fulfillment_status: "fulfilled" }

  const { data, isLoading } = useOrders(params)

  const formatGhs = (amount = 0) => 
    new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount)

  const tabs = [
    { id: "all", label: "All Orders" },
    { id: "pending", label: "Pending" },
    { id: "shipped", label: "Shipped" },
    { id: "delivered", label: "Delivered" },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Orders</h1>
        <p className="text-muted-foreground font-medium">Manage and fulfill your customer orders.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex overflow-x-auto pb-2 scrollbar-none gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border-2 ${
                filter === tab.id 
                  ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                  : "bg-card text-muted-foreground border-transparent hover:border-border hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 border-b-2 border-border font-bold uppercase">
              <tr>
                <th className="px-6 py-4">Order Details</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Fulfillment</th>
                <th className="px-6 py-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y border-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground font-bold animate-pulse">
                    Loading orders...
                  </td>
                </tr>
              ) : !data?.orders || data.orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <ShoppingBag className="h-8 w-8 opacity-40" />
                      </div>
                      <p className="font-bold text-lg text-foreground mb-1">No orders found</p>
                      <p className="text-sm max-w-xs mx-auto">There are no orders matching your current filter.</p>
                      {filter !== "all" && (
                        <Button variant="outline" className="mt-4" onClick={() => setFilter("all")}>
                          Clear Filter
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                data.orders.map(order => (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <Link to="/orders/$id" params={{ id: order.id }} className="block">
                        <div className="font-black text-primary text-base group-hover:underline">
                          #{order.display_id}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 font-medium">
                          {order.items?.length || 0} items
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">
                      {order.created_at ? format(new Date(order.created_at), "MMM d, yyyy") : "-"}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {order.customer_id ? order.email : "Guest"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={
                        order.fulfillment_status === "fulfilled" ? "success" : 
                        order.fulfillment_status === "shipped" ? "default" : 
                        "warning"
                      }>
                        {order.fulfillment_status === "not_fulfilled" ? "Pending" : 
                         order.fulfillment_status?.replace(/_/g, " ") || "Pending"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-lg">
                      {formatGhs(order.total ? order.total / 100 : 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}