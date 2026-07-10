import { createFileRoute } from "@tanstack/react-router";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { SectionHeader } from "@/components/shop/section-header";
import { ProductRail } from "@/components/shop/product-rail";
import { LineItem } from "@/components/shop/line-item";
import { OrderSummaryCard } from "@/components/shop/order-summary-card";
import {
  useGetCart,
  useUpdateCartItem,
  useRemoveCartItem,
  getGetCartQueryKey,
} from "@workspace/api-client-react";

export const Route = createFileRoute("/_shop/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — alkemart Ghana" },
      { name: "description", content: "Review your alkemart cart, pick delivery or pickup and continue to checkout." },
      { property: "og:title", content: "Your cart — alkemart" },
      { property: "og:description", content: "Review your items and check out." },
    ],
  }),
  component: CartPage,
});

function pesewasToLabel(pesewas: number): string {
  return `GH₵${(pesewas / 100).toFixed(2)}`;
}

function pesewasToPrice(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

function CartPage() {
  const queryClient = useQueryClient();
  const { data: cart, isLoading } = useGetCart();

  const invalidateCart = () => {
    queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
  };

  const updateCartItem = useUpdateCartItem({ mutation: { onSuccess: invalidateCart } });
  const removeCartItem = useRemoveCartItem({ mutation: { onSuccess: invalidateCart } });

  const items = cart?.items ?? [];
  const itemCount = items.reduce((sum: number, line) => sum + line.qty, 0);
  const subtotal = cart?.subtotalPesewas ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">
          Cart <span className="text-muted-foreground">({itemCount} item{itemCount === 1 ? "" : "s"})</span>
        </h1>
        <div className="text-sm text-muted-foreground">
          Delivering to <span className="font-semibold text-foreground">Accra, Osu</span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <button className="flex w-full items-center justify-between rounded-md border border-border bg-background p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-primary" aria-hidden="true">
                  <path d="M3 6h13v9H3zm14 3h3l2 3v3h-2a2 2 0 1 1-4 0h-3V9h4Z" />
                </svg>
              </div>
              <span className="font-display text-lg font-bold">Pickup and delivery options</span>
            </div>
            <ChevronDownIcon className="h-5 w-5" />
          </button>

          {isLoading ? (
            <LineItem loading />
          ) : items.length === 0 ? (
            <div className="rounded-md border border-border bg-background p-8 text-center text-sm text-muted-foreground">
              Your cart is empty. Browse the store to add items.
            </div>
          ) : (
            items.map((line) => (
              <LineItem
                key={line.id}
                title={line.product.title}
                now={pesewasToPrice(line.product.pricePesewas)}
                was={line.product.compareAtPesewas ? pesewasToPrice(line.product.compareAtPesewas) : undefined}
                color={line.product.brand ?? undefined}
                qty={line.qty}
                showAddOns={false}
                qtyPending={updateCartItem.isPending || removeCartItem.isPending}
                onIncrease={() => updateCartItem.mutate({ id: line.id, data: { qty: line.qty + 1 } })}
                onDecrease={() => {
                  if (line.qty <= 1) {
                    removeCartItem.mutate({ id: line.id });
                  } else {
                    updateCartItem.mutate({ id: line.id, data: { qty: line.qty - 1 } });
                  }
                }}
                onRemove={() => removeCartItem.mutate({ id: line.id })}
              />
            ))
          )}

          <div className="rounded-md border border-border bg-background p-6">
            <SectionHeader title="Match-day essentials — Black Stars" />
            <ProductRail count={5} columns={5} tag="best" showAdd />
          </div>
        </div>

        <aside className="lg:sticky lg:top-32 lg:h-max">
          <OrderSummaryCard
            itemCount={itemCount}
            subtotal={pesewasToLabel(subtotal)}
            total={pesewasToLabel(subtotal)}
            ctaTo="/checkout"
            ctaDisabled={items.length === 0}
          />
        </aside>
      </div>
    </div>
  );
}
