import { createFileRoute } from "@tanstack/react-router";
import { CheckCircledIcon } from "@radix-ui/react-icons";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shop/section-header";
import { ProductRail } from "@/components/shop/product-rail";
import { AddressCard } from "@/components/shop/address-card";
import { PaymentMethodCard } from "@/components/shop/payment-method-card";
import { PriceCents } from "@/components/shop/price-cents";
import { useGetOrder, OrderStatus, FulfillmentStatus } from "@workspace/api-client-react";
import type { OrderStatus as OrderStatusType, FulfillmentStatus as FulfillmentStatusType } from "@workspace/api-client-react";
import { requireAuthBeforeLoad, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_shop/order/$id")({
  beforeLoad: requireAuthBeforeLoad,
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.id} — alkemart Ghana` },
      { name: "description", content: "View order status, receipts and tracking on alkemart." },
      { property: "og:title", content: "Your order — alkemart" },
      { property: "og:description", content: "Track and manage your alkemart order." },
    ],
  }),
  component: OrderPage,
});

function pesewasToPrice(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

function statusLabel(status: OrderStatusType): string {
  switch (status) {
    case OrderStatus.pending:
      return "Payment pending";
    case OrderStatus.confirmed:
      return "Confirmed";
    case OrderStatus.fulfilled:
      return "Fulfilled";
    case OrderStatus.cancelled:
      return "Cancelled";
    default:
      return status;
  }
}

function statusBadgeVariant(status: OrderStatusType): "secondary" | "outline" | "destructive" {
  if (status === OrderStatus.fulfilled) return "secondary";
  if (status === OrderStatus.cancelled) return "destructive";
  return "outline";
}

function fulfillmentStatusLabel(status: FulfillmentStatusType): string {
  switch (status) {
    case FulfillmentStatus.unfulfilled:
      return "Preparing your order";
    case FulfillmentStatus.packed:
      return "Packed";
    case FulfillmentStatus.shipped:
      return "Shipped";
    case FulfillmentStatus.delivered:
      return "Delivered";
    default:
      return status;
  }
}

function fulfillmentBadgeVariant(status: FulfillmentStatusType): "secondary" | "outline" {
  return status === FulfillmentStatus.delivered ? "secondary" : "outline";
}

function OrderPage() {
  const { id } = Route.useParams();
  const orderId = Number.parseInt(id, 10);
  const { data: order, isLoading, isError } = useGetOrder(orderId);
  const { user } = useAuth();
  const buyerName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 py-10 text-sm text-muted-foreground">
        Loading your order…
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 py-10">
        <div className="rounded-md border border-border bg-background p-8 text-center text-sm text-muted-foreground">
          We couldn't find that order, or you don't have access to it.
        </div>
      </div>
    );
  }

  const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-10 px-6 py-10">
      <section className="rounded-md bg-success/10 p-8">
        <div className="flex flex-wrap items-center gap-3 text-success">
          <CheckCircledIcon className="h-6 w-6" />
          <div className="font-display text-2xl font-bold">Thanks for your order!</div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Order <span className="font-semibold text-foreground">#{order.id}</span> · Placed{" "}
          {new Date(order.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-md border border-border bg-background p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold">Order status</h2>
              <Badge variant={statusBadgeVariant(order.status)} className="capitalize">
                {statusLabel(order.status)}
              </Badge>
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-display text-xl font-bold">Items in this order</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-4"
                >
                  <div>
                    <div className="text-sm font-semibold">{item.titleSnapshot}</div>
                    <div className="text-xs text-muted-foreground">Qty {item.qty}</div>
                  </div>
                  <PriceCents now={pesewasToPrice(item.subtotalPesewas)} size="md" />
                </div>
              ))}
            </div>
          </section>

          {order.fulfillments.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold">Shipment status</h2>
              <div className="space-y-3">
                {order.fulfillments.map((fulfillment) => (
                  <div
                    key={fulfillment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-4"
                  >
                    <div className="text-sm font-semibold">Vendor shipment #{fulfillment.vendorId}</div>
                    <Badge variant={fulfillmentBadgeVariant(fulfillment.status)} className="capitalize">
                      {fulfillmentStatusLabel(fulfillment.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionHeader title="You may also like" linkTo="/browse/$slug" />
            <ProductRail count={6} columns={6} tag="rollback" showAdd />
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-border bg-background p-5">
            <h3 className="font-display text-lg font-bold">Order summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>
                  Subtotal ({itemCount} item{itemCount === 1 ? "" : "s"})
                </dt>
                <dd>GH₵{pesewasToPrice(order.subtotalPesewas)}</dd>
              </div>
              {order.discountPesewas > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Promo{order.promotionCode ? ` (${order.promotionCode})` : ""}</dt>
                  <dd>-GH₵{pesewasToPrice(order.discountPesewas)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>Delivery</dt>
                <dd>Free</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>
                  <PriceCents now={pesewasToPrice(order.totalPesewas)} size="md" />
                </dd>
              </div>
            </dl>
          </div>
          {order.address ? (
            <AddressCard
              name={order.address.fullName}
              line1={order.address.line1}
              city={order.address.city}
              region={order.address.region ?? undefined}
              digitalAddress={order.address.digitalAddress ?? undefined}
              phone={order.address.phone}
            />
          ) : (
            <AddressCard name={buyerName} phone={user?.phone ?? undefined} />
          )}
          <PaymentMethodCard paymentMethod={order.paymentMethod} isDefault />
        </aside>
      </div>
    </div>
  );
}
