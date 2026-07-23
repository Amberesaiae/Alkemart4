import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useOrders } from "../../hooks/use-orders"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/Table"
import { Badge } from "../../components/ui/Badge"

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
})

function OrdersPage() {
  const [status, setStatus] = useState<string | undefined>(undefined)
  const { data, isLoading } = useOrders({ status, limit: 50 })

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace Orders</h1>
          <p className="text-muted-foreground mt-2">View and track all platform orders.</p>
        </div>
        
        <select 
          className="h-10 px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-ring focus:outline-none"
          value={status || ""}
          onChange={(e) => setStatus(e.target.value || undefined)}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading orders...</TableCell>
              </TableRow>
            ) : !data?.orders?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No orders found.</TableCell>
              </TableRow>
            ) : (
              data.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">#{order.display_id}</TableCell>
                  <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {order.customer?.first_name} {order.customer?.last_name}
                    <div className="text-xs text-muted-foreground">{order.customer?.email}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    <span className="capitalize">{order.payment_status}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {order.currency_code.toUpperCase()} {(order.total / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  let variant: "default" | "secondary" | "destructive" | "success" | "warning" = "secondary"
  
  switch(status.toLowerCase()) {
    case "pending": variant = "warning"; break;
    case "completed":
    case "delivered": variant = "success"; break;
    case "cancelled": variant = "destructive"; break;
    case "processing": variant = "default"; break;
  }

  return <Badge variant={variant} className="capitalize">{status}</Badge>
}
