import { createFileRoute, Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useOrders } from "../../lib/hooks"
import { maskEmail } from "../../lib/api"
import { Card, Badge, Button, Skeleton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@workspace/ui"
import { format } from "date-fns"
import { ShoppingBag, AlertCircle } from "lucide-react"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"

export const Route = createFileRoute('/orders/')({
  component: OrdersPage,
})

function OrdersPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState("all")
  
  const params = filter === "all" ? undefined : 
                 filter === "pending" ? { fulfillment_status: "not_fulfilled" } :
                 filter === "shipped" ? { fulfillment_status: "shipped" } :
                 { fulfillment_status: "fulfilled" }

  const { data, isLoading, isError } = useOrders(params)

  const formatGhs = (amount = 0) => 
    new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount)

  const tabs = [
    { id: "all", label: "All Orders" },
    { id: "pending", label: "Pending" },
    { id: "shipped", label: "Shipped" },
    { id: "delivered", label: "Delivered" },
  ]

  return (
    <PageShell>
      <PageHeader title="Orders" description="Manage and fulfill your customer orders." />

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

      {isError ? (
        <Card className="p-8 text-center border-2 border-destructive/20">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-bold mb-1">Failed to load orders</h2>
          <p className="text-muted-foreground text-sm mb-4">Something went wrong. Please try again.</p>
          <Button onClick={() => { qc.invalidateQueries({ queryKey: ["vendor", "orders"] }) }} variant="outline" className="gap-2">
            Retry
          </Button>
        </Card>
      ) : (
        <Card className="border-2 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Details</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="text-center py-4">
                        <Skeleton className="h-4 w-full max-w-xs mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !data?.orders || data.orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-6 py-16 text-center">
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
                    </TableCell>
                  </TableRow>
                ) : (
                  data.orders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Link to="/orders/$id" params={{ id: order.id }} className="block">
                          <div className="font-black text-primary text-base group-hover:underline">
                            #{order.display_id}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-medium">
                            {order.items?.length || 0} items
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        {order.created_at ? format(new Date(order.created_at), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {maskEmail(order.email) || "Guest"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          order.fulfillment_status === "fulfilled" ? "success" : 
                          order.fulfillment_status === "shipped" ? "default" : 
                          "warning"
                        }>
                          {order.fulfillment_status === "not_fulfilled" ? "Pending" : 
                           order.fulfillment_status?.replace(/_/g, " ") || "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-black text-lg">
                        {formatGhs(order.total ? order.total / 100 : 0)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </PageShell>
  )
}