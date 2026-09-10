import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { useOrders } from "../../hooks/use-orders"
import type { AdminOrder } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Select, Skeleton, Button, Price, EmptyState } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
})

function StatusBadge({ status }: { status?: string }) {
  let variant: "default" | "secondary" | "destructive" | "success" | "warning" = "secondary"

  switch ((status ?? "").toLowerCase()) {
    case "pending":
    case "placed":
      variant = "warning"
      break
    case "completed":
    case "delivered":
      variant = "success"
      break
    case "cancelled":
      variant = "destructive"
      break
    case "processing":
    case "shipped":
      variant = "default"
      break
  }

  return <Badge variant={variant} className="capitalize">{status}</Badge>
}

function OrdersPage() {
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [offset, setOffset] = useState(0)
  const limit = 50
  const { data, isLoading, isError, refetch } = useOrders({ status, limit, offset })

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load orders.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
        <Table label="Marketplace orders">
          <caption className="sr-only">Marketplace orders list</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !data?.orders?.length ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState title="No orders found" />
                </TableCell>
              </TableRow>
            ) : (
              data.orders.map((order: AdminOrder) => (
                <TableRow key={order.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <Link to={"/orders/$id"} params={{ id: order.id }} className="hover:text-primary transition-colors">
                      #{order.display_id ?? "N/A"}
                    </Link>
                  </TableCell>
                  <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {order.customer?.first_name || order.customer?.last_name ? (
                      <div>
                        <div>
                          {`${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim()}
                        </div>
                        {order.customer?.email && (
                          <div className="text-xs text-muted-foreground">{order.customer.email}</div>
                        )}
                      </div>
                    ) : (
                      <div>{order.customer?.email || "Unknown customer"}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="capitalize">{order.payment_status}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <Price amount={order.total != null ? order.total / 100 : null} currency={order.currency_code} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {data?.orders?.length ? `${offset + 1}–${offset + data.orders.length}` : "0"} of {data?.count != null ? data.count : "…"}
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
