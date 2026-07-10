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
import {
  useGetCart,
  useCheckout,
  useListMyAddresses,
  useCreateMyAddress,
  getListMyNotificationsQueryKey,
  getListMyAddressesQueryKey,
  OrderPaymentMethod,
  MomoProvider,
} from "@workspace/api-client-react";
import { requireAuthBeforeLoad } from "@/lib/auth";

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

function pesewasToPrice(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: cart, isLoading } = useGetCart();
  const items = cart?.items ?? [];
  const itemCount = items.reduce((sum: number, line) => sum + line.qty, 0);
  const subtotal = cart?.subtotalPesewas ?? 0;

  const [promoCode, setPromoCode] = useState("");

  const { data: addressData, isLoading: addressesLoading } = useListMyAddresses();
  const addresses = addressData?.items ?? [];
  const [selectedAddressId, setSelectedAddressId] = useState<number | undefined>(undefined);
  const [addressFormOpen, setAddressFormOpen] = useState(false);

  const effectiveAddressId = selectedAddressId ?? addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id;

  const invalidateAddresses = () => queryClient.invalidateQueries({ queryKey: getListMyAddressesQueryKey() });
  const createAddress = useCreateMyAddress({
    mutation: {
      onSuccess: (created) => {
        invalidateAddresses();
        setSelectedAddressId(created.id);
        setAddressFormOpen(false);
      },
    },
  });

  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>(OrderPaymentMethod.momo);
  const [momoPhone, setMomoPhone] = useState("");
  const [momoProvider, setMomoProvider] = useState<MomoProvider>(MomoProvider.mtn);

  const checkout = useCheckout({
    mutation: {
      onSuccess: (order) => {
        queryClient.invalidateQueries({ queryKey: getListMyNotificationsQueryKey() });
        navigate({ to: "/order/$id", params: { id: String(order.id) } });
      },
    },
  });

  const paymentReady = paymentMethod === "cash_on_delivery" || momoPhone.trim().length >= 9;
  const canPlaceOrder = items.length > 0 && !isLoading && !!effectiveAddressId && paymentReady;

  function placeOrder() {
    if (!effectiveAddressId) return;
    checkout.mutate({
      data: {
        addressId: effectiveAddressId,
        paymentMethod,
        ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}),
        ...(paymentMethod === "momo" ? { momoPhone: momoPhone.trim(), momoProvider } : {}),
      },
    });
  }

  function handleAddAddress(values: AddressFormValues) {
    createAddress.mutate({ data: values });
  }

  const steps = [
    {
      id: "address",
      label: "Delivery address",
      content: (
        <div className="space-y-4">
          {addressesLoading ? (
            <p className="text-sm text-muted-foreground p-2">Loading your addresses…</p>
          ) : addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">
              You don't have a saved delivery address yet. Add one below to continue.
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
                  onSelect={() => setSelectedAddressId(a.id)}
                />
              ))}
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
          <p className="text-xs text-muted-foreground">Delivery is free on this order.</p>
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
          {checkout.isError && (
            <p className="text-sm text-destructive p-2">
              {(checkout.error as { response?: { data?: { error?: string } } } | undefined)?.response?.data?.error ??
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
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-6 py-8">
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
            subtotal={`GH₵${pesewasToPrice(subtotal)}`}
            total={`GH₵${pesewasToPrice(subtotal)}`}
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
    </div>
  );
}
