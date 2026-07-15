import { useState } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import { useGetCart, useListMyAddresses, useCreateMyAddress } from "@/lib/hooks-cart"
import {
  useGhanaCheckout,
  OrderPaymentMethod,
  MomoProvider,
  type GhanaCheckoutResult,
  type OrderPaymentMethod as OrderPaymentMethodType,
  type MomoProvider as MomoProviderType,
} from "@/lib/hooks-checkout"
import { useGetMe } from "@/lib/hooks-auth"
import { requireAuthBeforeLoad } from "@/lib/auth"
import { pesewasToLabel, pesewasToPrice } from "@/lib/money";
import { ShopPage } from "@/components/shop/shop-page";

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
  "Secure encrypted checkout",
  "Free 14-day returns to any alkemart hub",
  "Backed by alkemart Ghana customer care",
];


function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethodType>(
    OrderPaymentMethod.momo,
  );
  const [momoPhone, setMomoPhone] = useState("");
  const [momoProvider, setMomoProvider] = useState<MomoProviderType>(MomoProvider.mtn);

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
          {addressesLoading ? (
            <p className="text-sm text-muted-foreground p-2">Loading your addresses…</p>
          ) : addresses.length === 0 && !inlineAddress ? (
            <p className="text-sm text-muted-foreground p-2">
              You don't have a saved delivery address yet. Add one below to continue — you can place
              the order with the form even if save is skipped.
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
      label: "How would you like to get it?",
      content: (
        <div className="space-y-4">
          <FulfillmentPicker selected="shipping" />
          <p className="text-xs text-muted-foreground">Shipping cost confirmed at checkout based on your address.</p>
        </div>
      ),
    },
    {
      id: "payment",
      label: "Payment method",
      content: (
        <PaymentMethodSelector
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          momoPhone={momoPhone}
          onMomoPhoneChange={setMomoPhone}
          momoProvider={momoProvider}
          onMomoProviderChange={setMomoProvider}
        />
      ),
    },
    {
      id: "review",
      label: "Review your order",
      content: (
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-2">Loading your cart…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">
              Your cart is empty. Add items before checking out.
            </p>
          ) : (
            items.map((line) => (
              <div key={line.id} className="flex items-center gap-3 rounded-md border border-border p-4 bg-background">
                <div className="w-16">
                  <ImageSlot ratio={1} rounded="sm" tone="brand" src={line.product.imageUrl} alt={line.product.title} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">
                    {line.product.title}
                  </div>
                  <div className="text-xs text-muted-foreground">Qty {line.qty} · Ships free</div>
                </div>
                <PriceCents now={pesewasToPrice(line.product.pricePesewas * line.qty)} size="md" />
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
                className="mt-1"
              />
            </div>
          </div>
          {pendingPayment && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Approve Mobile Money on your phone
              </p>
              <p className="text-sm text-muted-foreground">
                We started a Mobile Money charge. Confirm the prompt on your handset to complete
                payment. Your cart is held until payment succeeds or expires.
              </p>
              {pendingPayment.expires_at && (
                <p className="text-xs text-muted-foreground">
                  Expires: {new Date(pendingPayment.expires_at).toLocaleString()}
                </p>
              )}
              {typeof pendingPayment.amount_pesewas === "number" && (
                <p className="text-xs text-muted-foreground">
                  Amount: {pesewasToLabel(pendingPayment.amount_pesewas)}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate({ to: "/orders" })}
                >
                  View orders
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingPayment(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          {checkout.isError && (
            <p className="text-sm text-destructive p-2">
              {(checkout.error as Error | undefined)?.message ??
                "We couldn't place your order. Please check your delivery address, payment details and cart, then try again."}
            </p>
          )}
          <Button
            size="lg"
            className="w-full"
            disabled={!canPlaceOrder || checkout.isPending}
            onClick={placeOrder}
          >
            {checkout.isPending ? "Placing order…" : "Place order"}
          </Button>
          <p className="text-xs text-muted-foreground">
            By placing this order, you agree to alkemart's Terms and acknowledge our Privacy Notice.
          </p>
        </div>
      ),
    },
  ];

  return (
    <ShopPage dense className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">Checkout</h1>
        <Stepper steps={["Cart", "Delivery", "Payment", "Review"]} current={1} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <Accordion type="single" defaultValue="address" collapsible className="space-y-3">
          {steps.map((s, i) => (
            <AccordionItem
              key={s.id}
              value={s.id}
              className="rounded-md border border-border bg-background px-6"
            >
              <AccordionTrigger className="text-base font-bold">
                <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
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
            ctaLabel={checkout.isPending ? "Placing order…" : "Place order"}
            ctaDisabled={!canPlaceOrder || checkout.isPending}
            onCtaClick={placeOrder}
          />
          <div className="rounded-md border border-border bg-background p-5">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider">
              Why check out with alkemart
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              {trust.map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
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
