import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ImageSlot } from "@/components/shop/image-slot";
import { PriceCents } from "@/components/shop/price-cents";
import { OrderSummaryCard } from "@/components/shop/order-summary-card";
import { FulfillmentPicker } from "@/components/shop/fulfillment-picker";
import { Stepper } from "@/components/shop/stepper";
import { AddressCard } from "@/components/shop/address-card";
import { AddressForm, type AddressFormValues } from "@/components/shop/address-form";
import { PaymentMethodSelector } from "@/components/shop/payment-method-selector";
import { PaymentChannelBadges } from "@/components/shop/payment-channel-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCart, useListMyAddresses, useCreateMyAddress } from "@/lib/hooks-cart"
import {
  useGhanaCheckout,
  pollGhanaCheckoutStatus,
  OrderPaymentMethod,
  MomoProvider,
  type GhanaCheckoutResult,
  type OrderPaymentMethod as OrderPaymentMethodType,
  type MomoProvider as MomoProviderType,
} from "@/lib/hooks-checkout"
import { useGetMe } from "@/lib/hooks-auth"
import { requireAuthBeforeLoad } from "@/lib/auth"
import { useMedusa } from "@/lib/medusa-provider"
import { getLabDemoBanner, isMomoLabEnabled } from "@/lib/platform-features"
import { pesewasToLabel, pesewasToPrice } from "@/lib/money";
import { ShopPage } from "@/components/shop/shop-page";
import { toast } from "sonner";

export const Route = createFileRoute("/_shop/checkout")({
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({
    meta: [
      { title: "Checkout — alkemart Ghana" },
      { name: "description", content: "Confirm delivery, address and payment on alkemart Ghana." },
      { property: "og:title", content: "Checkout — alkemart" },
      { property: "og:description", content: "Confirm and place your order." },
    ],
  }),
  component: CheckoutPage,
});

const trust = [
  "Lab demo: cash on delivery is the supported path",
  "Delivery options based on seller shipping in Ghana",
  "Orders are marketplace lab data — not production receipts",
];


function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sdk = useMedusa();
  const { data: cart, isLoading } = useGetCart();
  const { data: meData } = useGetMe();
  const userEmail = meData?.user?.email;
  const items = cart?.items ?? [];
  const itemCount = items.reduce((sum: number, line) => sum + line.qty, 0);
  const subtotal = cart?.subtotalPesewas ?? 0;

  const [promoCode, setPromoCode] = useState("");

  const { data: addressData, isLoading: addressesLoading } = useListMyAddresses();
  const addresses = addressData?.items ?? [];
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(undefined);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  /** When list is empty, allow place-order with form values without a saved id. */
  const [inlineAddress, setInlineAddress] = useState<AddressFormValues | null>(null);
  const [pendingPayment, setPendingPayment] = useState<Extract<
    GhanaCheckoutResult,
    { status: "payment_pending" }
  > | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll MoMo status while pending (webhook or re-verify)
  useEffect(() => {
    if (!pendingPayment?.cart_id) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }
    const cartId = pendingPayment.cart_id
    let ticks = 0
    const tick = async () => {
      ticks += 1
      if (ticks > 60) {
        // ~5 min at 5s
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        return
      }
      try {
        const result = await pollGhanaCheckoutStatus(sdk, cartId)
        if (result.status === "completed" && "order_id" in result && result.order_id) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          setPendingPayment(null)
          queryClient.invalidateQueries({ queryKey: ["medusa", "cart"] })
          queryClient.invalidateQueries({ queryKey: ["medusa", "orders"] })
          toast.success("Payment confirmed")
          navigate({ to: "/order/$id", params: { id: String(result.order_id) } })
          return
        }
        if (result.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          setPendingPayment(null)
          toast.error(result.message || "Mobile Money payment failed")
        }
      } catch {
        /* keep polling */
      }
    }
    void tick()
    pollRef.current = setInterval(tick, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [pendingPayment?.cart_id, sdk, navigate, queryClient])

  const effectiveAddressId =
    selectedAddressId ??
    addresses.find((a) => a.isDefault)?.id ??
    addresses[0]?.id;

  const selectedAddress =
    addresses.find((a) => a.id === effectiveAddressId) ?? undefined;

  const createAddress = useCreateMyAddress({
    mutation: {
      onSuccess: (created) => {
        setSelectedAddressId(created.id);
        setInlineAddress(null);
        setAddressFormOpen(false);
      },
    },
  });

  // Mode B: COD is the supported product path (MoMo lab-only via flag).
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethodType>(
    OrderPaymentMethod.cash_on_delivery,
  );
  const [momoPhone, setMomoPhone] = useState("");
  const [momoProvider, setMomoProvider] = useState<MomoProviderType>(MomoProvider.mtn);

  // If MoMo lab is off, never leave payment stuck on momo.
  useEffect(() => {
    if (!isMomoLabEnabled() && paymentMethod === OrderPaymentMethod.momo) {
      setPaymentMethod(OrderPaymentMethod.cash_on_delivery)
    }
  }, [paymentMethod])

  const checkout = useGhanaCheckout({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: ["medusa", "notifications"] })
        if (result.status === "completed") {
          setPendingPayment(null);
          navigate({ to: "/order/$id", params: { id: String(result.order_id) } });
          return;
        }
        // MoMo async: keep cart, show approve-on-phone state (do not fake order id).
        setPendingPayment(result);
      },
    },
  });

  const paymentReady = paymentMethod === "cash_on_delivery" || momoPhone.trim().length >= 9;
  const hasDeliveryAddress = Boolean(selectedAddress || inlineAddress);
  const canPlaceOrder =
    items.length > 0 && !isLoading && hasDeliveryAddress && paymentReady && !pendingPayment;

  function placeOrder() {
    if (!selectedAddress && !inlineAddress) return;
    checkout.mutate({
      data: {
        address: selectedAddress,
        inlineAddress: selectedAddress ? undefined : inlineAddress ?? undefined,
        paymentMethod,
        email: userEmail,
        ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}),
        ...(paymentMethod === "momo"
          ? { momoPhone: momoPhone.trim(), momoProvider }
          : {}),
      },
    });
  }

  function handleAddAddress(values: AddressFormValues) {
    // Always keep form values so checkout can proceed even if save fails / list empty.
    setInlineAddress(values);
    createAddress.mutate(
      { data: values },
      {
        onError: () => {
          // Inline address still set — user can place order without a saved id.
          setAddressFormOpen(false);
        },
      },
    );
  }

  const steps = [
    {
      id: "address",
      label: "Delivery address",
      content: (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Include a phone number we can reach. GhanaPost GPS or a clear landmark helps
            riders find you.
          </p>
          {addressesLoading ? (
            <div className="grid gap-3 md:grid-cols-2" role="status" aria-label="Loading addresses">
              <span className="sr-only">Loading your addresses…</span>
              <Skeleton className="h-28 rounded-xl bg-muted" />
              <Skeleton className="h-28 rounded-xl bg-muted" />
            </div>
          ) : addresses.length === 0 && !inlineAddress ? (
            <p className="text-sm text-muted-foreground p-2">
              Add a delivery address to continue. You can place the order with this form even
              if save fails.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {addresses.map((a) => (
                <AddressCard
                  key={a.id}
                  name={a.label ? `${a.fullName} — ${a.label}` : a.fullName}
                  line1={a.line1}
                  city={a.city}
                  region={a.region ?? undefined}
                  digitalAddress={a.digitalAddress ?? undefined}
                  phone={a.phone}
                  isDefault={a.isDefault}
                  selectable
                  selected={effectiveAddressId === a.id}
                  onSelect={() => {
                    setSelectedAddressId(a.id);
                    setInlineAddress(null);
                  }}
                />
              ))}
              {inlineAddress && addresses.length === 0 && (
                <AddressCard
                  name={inlineAddress.fullName}
                  line1={inlineAddress.line1}
                  city={inlineAddress.city}
                  region={inlineAddress.region}
                  digitalAddress={inlineAddress.digitalAddress}
                  phone={inlineAddress.phone}
                  selectable
                  selected
                  onSelect={() => {}}
                />
              )}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setAddressFormOpen(true)}>
            + Add a new address
          </Button>
        </div>
      ),
    },
    {
      id: "fulfillment",
      label: "Delivery",
      content: (
        <div className="space-y-4">
          <FulfillmentPicker selected="shipping" />
          <p className="text-xs text-muted-foreground">
            Delivery fees and windows depend on your address and the seller. Confirmed when
            you place the order.
          </p>
        </div>
      ),
    },
    {
      id: "payment",
      label: "Payment",
      content: (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Mobile money is the recommended way to pay in Ghana. You will approve the charge
            on your phone.
          </p>
          <PaymentMethodSelector
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            momoPhone={momoPhone}
            onMomoPhoneChange={setMomoPhone}
            momoProvider={momoProvider}
            onMomoProviderChange={setMomoProvider}
          />
        </div>
      ),
    },
    {
      id: "review",
      label: "Review & place order",
      content: (
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading cart">
              <span className="sr-only">Loading your cart…</span>
              <Skeleton className="h-20 rounded-xl bg-muted" />
              <Skeleton className="h-20 rounded-xl bg-muted" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">
              Your cart is empty. Add items before checking out.
            </p>
          ) : (
            items.map((line) => (
              <div
                key={line.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="w-16 shrink-0">
                  <ImageSlot
                    ratio={1}
                    rounded="sm"
                    tone="brand"
                    src={line.product.imageUrl}
                    alt={line.product.title}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{line.product.title}</div>
                  {line.product.vendorName ? (
                    <div className="text-xs text-muted-foreground">
                      Sold by{" "}
                      <span className="font-medium text-foreground">
                        {line.product.vendorName}
                      </span>
                    </div>
                  ) : null}
                  <div className="text-xs text-muted-foreground">Qty {line.qty}</div>
                </div>
                <PriceCents
                  now={pesewasToPrice(line.product.pricePesewas * line.qty)}
                  size="md"
                />
              </div>
            ))
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="promo-code" className="text-xs font-semibold text-muted-foreground">
                Promo code
              </label>
              <Input
                id="promo-code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter a code"
                className="mt-1 rounded-lg"
              />
            </div>
          </div>
          {pendingPayment && (
            <div className="space-y-2 rounded-xl border border-primary bg-primary/10 p-4">
              <p className="text-sm font-bold text-foreground">
                Approve Mobile Money on your phone
              </p>
              <p className="text-sm text-muted-foreground">
                Confirm the MoMo prompt on your handset to complete payment. Your cart is held
                until payment succeeds or expires.
              </p>
              {pendingPayment.expires_at && (
                <p className="text-xs text-muted-foreground">
                  Expires: {new Date(pendingPayment.expires_at).toLocaleString()}
                </p>
              )}
              {typeof pendingPayment.amount_pesewas === "number" && (
                <p className="text-xs font-semibold text-foreground">
                  Amount: {pesewasToLabel(pendingPayment.amount_pesewas)}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => navigate({ to: "/orders" })}>
                  View orders
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingPayment(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          {checkout.isError && (
            <p className="p-2 text-sm text-destructive">
              {(checkout.error as Error | undefined)?.message ??
                "We couldn't place your order. Check address, payment details and cart, then try again."}
            </p>
          )}
          <Button
            size="lg"
            className="min-h-11 w-full rounded-full font-bold"
            disabled={!canPlaceOrder || checkout.isPending}
            onClick={placeOrder}
          >
            {checkout.isPending
              ? "Placing order…"
              : paymentMethod === OrderPaymentMethod.cash_on_delivery
                ? "Place COD order"
                : "Place lab MoMo order"}
          </Button>
          <p className="text-xs text-muted-foreground">
            By placing this order you agree to alkemart&apos;s Terms and Privacy Notice.
          </p>
        </div>
      ),
    },
  ];

  return (
    <ShopPage dense className="space-y-6 md:space-y-8">
      <div
        role="status"
        className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
      >
        {getLabDemoBanner()}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-eyebrow">Checkout</p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Checkout</h1>
        </div>
        <Stepper steps={["Cart", "Delivery", "Payment", "Review"]} current={1} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Accordion type="single" defaultValue="address" collapsible className="space-y-3">
          {steps.map((s, i) => (
            <AccordionItem
              key={s.id}
              value={s.id}
              className="rounded-xl border border-border bg-card px-5 shadow-sm md:px-6"
            >
              <AccordionTrigger className="text-base font-bold hover:no-underline">
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                {s.label}
              </AccordionTrigger>
              <AccordionContent className="pb-6">{s.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <aside className="order-first space-y-4 lg:order-last lg:sticky lg:top-32 lg:h-max">
          <OrderSummaryCard
            itemCount={itemCount}
            subtotal={pesewasToLabel(subtotal)}
            total={pesewasToLabel(subtotal)}
            shipping="At checkout"
            taxes="At checkout"
            ctaLabel={
              checkout.isPending
                ? "Placing order…"
                : paymentMethod === OrderPaymentMethod.cash_on_delivery
                  ? "Place COD order"
                  : "Place lab MoMo order"
            }
            ctaDisabled={!canPlaceOrder || checkout.isPending}
            onCtaClick={placeOrder}
            footerNote="GHS totals. Lab demo — cash on delivery is the supported path."
          />
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Checkout with confidence
            </h3>
            <div className="mt-3">
              {isMomoLabEnabled() ? (
                <PaymentChannelBadges
                  channels={["mtn", "telecel", "at", "card", "bank"]}
                  size="sm"
                  showPaystack
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Cash on delivery</span>
                  {" — "}supported lab payment. MoMo is not product-enabled.
                </p>
              )}
            </div>
            <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
              {trust.map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckIcon
                    className="mt-0.5 h-4 w-4 shrink-0 text-success"
                    aria-hidden
                  />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <AddressForm
        open={addressFormOpen}
        onOpenChange={setAddressFormOpen}
        isSaving={createAddress.isPending}
        onSubmit={handleAddAddress}
      />
    </ShopPage>
  );
}
