import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircledIcon, ClockIcon } from "@radix-ui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SectionHeader } from "@/components/shop/section-header";
import { ProductRail } from "@/components/shop/product-rail";
import { AddressCard } from "@/components/shop/address-card";
import { PaymentMethodCard } from "@/components/shop/payment-method-card";
import { PriceCents } from "@/components/shop/price-cents";
import {
  useGetOrder,
} from "@/lib/hooks-orders"
import type { AlkemartOrder } from "@/lib/hooks-orders"
import { requireAuthBeforeLoad, useAuth } from "@/lib/auth";
import { formatOrderNumber, getLabDemoBanner } from "@/lib/platform-features";
import { toast } from "sonner";
import { pesewasToLabel, pesewasToPrice } from "@/lib/money";
import { ShopPage } from "@/components/shop/shop-page";

const SUPPORT_EMAIL = "support@alkemart.local"

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


function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Payment pending"
    case "confirmed":
      return "Confirmed"
    case "fulfilled":
      return "Fulfilled"
    case "cancelled":
      return "Cancelled"
    default:
      return status
  }
}

function statusBadgeVariant(status: string): "secondary" | "outline" | "destructive" {
  if (status === "fulfilled") return "secondary"
  if (status === "cancelled") return "destructive"
  return "outline"
}

function fulfillmentStatusLabel(status: string): string {
  switch (status) {
    case "not_delivered":
      return "Preparing your order"
    case "partially_delivered":
      return "Packed"
    case "delivered":
      return "Delivered"
    default:
      return status
  }
}

function fulfillmentBadgeVariant(status: string): "secondary" | "outline" {
  return status === "delivered" ? "secondary" : "outline"
}

function OrderPage() {
  const { id } = Route.useParams()
  const orderId = id
  const { data: order, isLoading, isError, refetch } = useGetOrder(id)
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const buyerName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined;

  // Poll for pending orders (payment status polling per architecture doc B.1.9).
  const isPending = order?.status === "pending";
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartTime = useRef<number>(Date.now());

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isPending) {
      stopPolling();
      return;
    }

    // Start polling: 2s, 3s, 5s backoff capped at 5s.
    let delay = 2000;
    const maxDelay = 5000;
    const maxWallClockMs = 35 * 60 * 1000; // TTL + 60s grace

    function poll() {
      refetch().then((result) => {
        const newStatus = result.data?.status;
        if (newStatus && newStatus !== "pending") {
          stopPolling();
          queryClient.invalidateQueries({ queryKey: ["medusa", "order", orderId] });
          return;
        }
        if (Date.now() - pollStartTime.current > maxWallClockMs) {
          stopPolling();
          return;
        }
        delay = Math.min(delay * 1.5, maxDelay);
        pollRef.current = setTimeout(() => {
          pollRef.current = null;
          poll();
        }, delay) as any;
      });
    }

    pollRef.current = setTimeout(() => {
      pollRef.current = null;
      poll();
    }, delay) as any;

    return stopPolling;
  }, [isPending, orderId, refetch, stopPolling, queryClient]);

  // Dispute sheet state (email support until Medusa dispute port)
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");

  function handleDisputeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    const body = [
      `Order: ${orderId}`,
      `Subject: ${subject.trim()}`,
      note.trim() ? `Details: ${note.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      `[Dispute] ${subject.trim()} — ${orderId}`,
    )}&body=${encodeURIComponent(body)}`;
    toast.message("Opening your email app to contact support…");
    setDisputeOpen(false);
  }

  function handleCancelRequest() {
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      `[Cancel request] ${orderId}`,
    )}&body=${encodeURIComponent(
      `Please cancel order ${orderId}.\nCustomer: ${user?.email ?? "unknown"}`,
    )}`;
    toast.message("Self-serve cancel is not online yet — we opened an email to support.");
  }

  if (isLoading) {
    return (
      <ShopPage dense className="text-sm text-muted-foreground">
        Loading your order…
      </ShopPage>
    );
  }

  if (isError || !order) {
    return (
      <ShopPage dense>
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          We couldn&apos;t find that order, or you don&apos;t have access to it.
        </div>
      </ShopPage>
    );
  }

  const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);
  const canCancel = order.status === "confirmed" || order.status === "pending"
  const canDispute = order.status === "confirmed" || order.status === "fulfilled"

  const orderLabel = formatOrderNumber(order)

  return (
    <ShopPage dense>
      <div
        role="status"
        className="mb-4 rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
      >
        {getLabDemoBanner()} Reference{" "}
        <span className="font-mono font-semibold">{orderLabel}</span>
        {order.displayId == null ? (
          <span className="block mt-1 text-xs opacity-90">
            No formal display number yet — Medusa id {order.id} is internal lab data.
          </span>
        ) : null}
      </div>
      {/* Pending payment banner */}
      {isPending ? (
        <section className="rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-8">
          <div className="flex flex-wrap items-center gap-3 text-yellow-700 dark:text-yellow-300">
            <ClockIcon className="h-6 w-6 animate-pulse" />
            <div className="font-display text-2xl font-bold">Waiting for payment</div>
          </div>
          <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
            Approve the prompt or USSD on your phone to complete the payment. This page will update automatically.
          </p>
          <p className="mt-1 text-xs text-yellow-500 dark:text-yellow-500">
            Payment expires in 30 minutes if not completed.
          </p>
        </section>
      ) : (
        <section className="rounded-md bg-success/10 p-8">
          <div className="flex flex-wrap items-center gap-3 text-success">
            <CheckCircledIcon className="h-6 w-6" />
            <div className="font-display text-2xl font-bold">Thanks for your order!</div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Order <span className="font-semibold text-foreground">{orderLabel}</span> · Placed{" "}
            {new Date(order.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-md border border-border bg-background p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold">Order status</h2>
              <Badge variant={statusBadgeVariant(order.status)} className="capitalize">
                {statusLabel(order.status)}
              </Badge>
            </div>
            {canCancel && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/5">
                      Request cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel order {orderLabel}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Self-serve cancel is not enabled on the marketplace API yet.
                        {order.paymentMethod === "momo"
                          ? " MoMo refunds, when due, are handled by support within 3–5 business days."
                          : " COD orders can be stopped before dispatch via support."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep order</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelRequest}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Email support to cancel
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </section>

          {canDispute && (
            <Sheet open={disputeOpen} onOpenChange={setDisputeOpen}>
              <SheetTrigger asChild>
                <button className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors">
                  Have a problem with this order? Open a dispute
                </button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Open a dispute</SheetTitle>
                  <SheetDescription>
                    Describe the issue with order #{order.id}. Our support team will review it and get back to you.
                  </SheetDescription>
                </SheetHeader>
                <form onSubmit={handleDisputeSubmit} className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="dispute-subject">Subject</Label>
                    <Input
                      id="dispute-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Item not received"
                      maxLength={120}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dispute-note">Description (optional)</Label>
                    <textarea
                      id="dispute-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Please describe what happened in detail…"
                      rows={5}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    />
                  </div>
                  <SheetFooter className="pt-2">
                    <Button type="submit" disabled={!subject.trim()} className="w-full">
                      Email support
                    </Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          )}

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

          {(order.fulfillments?.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold">Shipment status</h2>
              <div className="space-y-3">
                {order.fulfillments.map((fulfillment) => (
                  <div
                    key={fulfillment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-4"
                  >
                    <div className="text-sm font-semibold">
                      {fulfillment.vendorId
                        ? `Shipment · ${fulfillment.vendorId}`
                        : "Shipment"}
                    </div>
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
                <dd>{pesewasToLabel(order.subtotalPesewas)}</dd>
              </div>
              {(order.discountPesewas ?? 0) > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Promo{order.promotionCode ? ` (${order.promotionCode})` : ""}</dt>
                  <dd>-{pesewasToLabel(order.discountPesewas)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>Delivery</dt>
                <dd>
                  {(order.shippingTotalPesewas ?? 0) > 0
                    ? pesewasToLabel(order.shippingTotalPesewas)
                    : "Included"}
                </dd>
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
          <PaymentMethodCard
            paymentMethod={
              order.paymentMethod === "momo"
                ? "momo"
                : order.paymentMethod === "cod"
                  ? "cash_on_delivery"
                  : "cash_on_delivery"
            }
            isDefault
          />
        </aside>
      </div>
    </ShopPage>
  );
}
