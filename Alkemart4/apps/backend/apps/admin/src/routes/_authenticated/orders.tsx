import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useOrders } from "../../hooks/use-orders"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Select, Skeleton, Button, Price, EmptyState } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
})

function StatusBadge({ status }: { status?: string }) {
  let variant: "default" | "secondary" | "destructive" | "success" | "warning" = "secondary"

  switch((status ?? "").toLowerCase()) {
    case "pending": variant = "warning"; break
    case "completed":
    case "delivered": variant = "success"; break
    case "cancelled": variant = "destructive"; break
    case "processing": variant = "default"; break
  }

  return <Badge variant={variant} className="capitalize">{status}</Badge>
}

function OrdersPage() {
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [offset, setOffset] = useState(0)
  const limit = 50
  const { data, isLoading, isError } = useOrders({ status, limit, offset })

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load orders.</span>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <PageHeader title="Marketplace Orders" description="View and track all platform orders." />
        <Select
          value={status || ""}
          onChange={(e) => { setStatus(e.target.value || undefined); setOffset(0) }}
          className="h-10 w-full sm:w-48"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      <div className="border rounded-xl bg-card">
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
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !data?.orders?.length ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState title="No orders found" />
                </TableCell>
              </TableRow>
            ) : (
              data.orders.map((order: any) => (
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
                    <Price amount={order.total != null ? order.total / 100 : null} currency={order.currency_code} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {data?.orders?.length ? `${offset + 1}–${offset + data.orders.length}` : "0"} of {data?.count ?? "..."}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}>
            Previous
          </Button>
          <Button variant="outline" disabled={!data?.orders || data.orders.length < limit} onClick={() => setOffset(o => o + limit)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  )
}
