import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  useListVendorOrders,
  useUpdateVendorOrderFulfillment,
  getListVendorOrdersQueryKey,
  OrderStatus,
  FulfillmentStatus,
} from "@workspace/api-client-react";
import type { VendorOrderItem, OrderStatus as OrderStatusType, FulfillmentStatus as FulfillmentStatusType } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VendorShell } from "@/components/vendor/vendor-nav";

const ordersSearchSchema = z.object({ date: z.string().optional() });

export const Route = createFileRoute("/_shop/vendor/orders")({
  head: () => ({
    meta: [{ title: "Orders — Vendor dashboard — alkemart Ghana" }],
  }),
  validateSearch: ordersSearchSchema,
  component: VendorOrdersPage,
});

function pesewasToPrice(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

function orderStatusBadgeVariant(status: OrderStatusType): "secondary" | "outline" | "destructive" {
  if (status === OrderStatus.fulfilled) return "secondary";
  if (status === OrderStatus.cancelled) return "destructive";
  return "outline";
}

function fulfillmentStatusBadgeVariant(status: FulfillmentStatusType): "secondary" | "outline" {
  return status === FulfillmentStatus.delivered ? "secondary" : "outline";
}

const FULFILLMENT_NEXT_STATUS: Record<FulfillmentStatusType, FulfillmentStatusType | null> = {
  [FulfillmentStatus.unfulfilled]: FulfillmentStatus.packed,
  [FulfillmentStatus.packed]: FulfillmentStatus.shipped,
  [FulfillmentStatus.shipped]: FulfillmentStatus.delivered,
  [FulfillmentStatus.delivered]: null,
};

function toDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function VendorOrdersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const { data, isLoading } = useListVendorOrders();
  const allItems: VendorOrderItem[] = data?.items ?? [];
  const items = search.date ? allItems.filter((item) => toDateKey(item.orderCreatedAt) === search.date) : allItems;

  const updateFulfillment = useUpdateVendorOrderFulfillment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListVendorOrdersQueryKey() });
      },
    },
  });

  return (
    <VendorShell title="Orders" description="Line items from buyer orders that include your products.">
      <div className="rounded-md border border-border p-6">
        {search.date && (
          <div className="mb-4 flex items-center justify-between rounded-md bg-surface/50 px-3 py-2 text-sm">
            <span>
              Showing orders placed on{" "}
              <span className="font-semibold">
                {new Date(`${search.date}T00:00:00`).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </span>
            <Button size="sm" variant="outline" onClick={() => navigate({ search: {} })}>
              Clear filter
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Line total</TableHead>
                <TableHead>Order status</TableHead>
                <TableHead>Fulfillment</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Loading orders…
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    {search.date ? "No orders placed on this date." : "No orders yet for your products."}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const nextStatus = FULFILLMENT_NEXT_STATUS[item.fulfillmentStatus];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">#{item.orderId}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.orderCreatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{item.titleSnapshot}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>GH₵{pesewasToPrice(item.subtotalPesewas)}</TableCell>
                      <TableCell>
                        <Badge variant={orderStatusBadgeVariant(item.orderStatus)} className="capitalize">
                          {item.orderStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={fulfillmentStatusBadgeVariant(item.fulfillmentStatus)} className="capitalize">
                          {item.fulfillmentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {nextStatus && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updateFulfillment.isPending}
                            onClick={() =>
                              updateFulfillment.mutate({ orderId: item.orderId, data: { status: nextStatus } })
                            }
                          >
                            Mark as {nextStatus}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </VendorShell>
  );
}
