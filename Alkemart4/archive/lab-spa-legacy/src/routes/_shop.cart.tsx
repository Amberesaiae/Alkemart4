import { createFileRoute, Link } from "@tanstack/react-router";
import { ShopPage } from "@/components/shop/shop-page";
import { LineItem } from "@/components/shop/line-item";
import { OrderSummaryCard } from "@/components/shop/order-summary-card";
import { pesewasToLabel, pesewasToPrice } from "@/lib/money";
import { useAuth } from "@/lib/auth";
import { getLabDemoBanner } from "@/lib/platform-features";
import {
  useGetCart,
  useUpdateCartItem,
  useRemoveCartItem,
  useListMyAddresses,
} from "@/lib/hooks-cart";

export const Route = createFileRoute("/_shop/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — alkemart Ghana" },
      {
        name: "description",
        content:
          "Review your cart on alkemart Ghana lab. Cash on delivery at checkout.",
      },
      { property: "og:title", content: "Your cart — alkemart" },
      { property: "og:description", content: "Review your items and check out." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { isAuthenticated } = useAuth();
  const { data: cart, isLoading } = useGetCart();
  const { data: addresses } = useListMyAddresses();

  const updateCartItem = useUpdateCartItem();
  const removeCartItem = useRemoveCartItem();

  const items = cart?.items ?? [];
  const itemCount = items.reduce((sum: number, line) => sum + line.qty, 0);
  const subtotal = cart?.subtotalPesewas ?? 0;

  const addressList = addresses?.items ?? [];
  const deliveryTarget = addressList.find((a) => a.isDefault) ?? addressList[0];
  const deliveryLabel = deliveryTarget
    ? [deliveryTarget.city, deliveryTarget.line1].filter(Boolean).join(" · ") ||
      deliveryTarget.line1
    : null;

  return (
    <ShopPage dense className="space-y-6 md:space-y-8">
      <div
        role="status"
        className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
      >
        {getLabDemoBanner()}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-eyebrow">Cart</p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Your cart{" "}
            <span className="text-base font-semibold tabular-nums text-muted-foreground">
              ({itemCount} item{itemCount === 1 ? "" : "s"})
            </span>
          </h1>
        </div>
        <div className="max-w-sm text-sm text-muted-foreground md:text-right">
          {deliveryLabel ? (
            <>
              Deliver to{" "}
              <span className="font-semibold text-foreground">{deliveryLabel}</span>
            </>
          ) : isAuthenticated ? (
            <>
              No delivery address yet.{" "}
              <Link
                to="/account/addresses"
                className="font-semibold text-link hover:underline"
              >
                Add one
              </Link>
            </>
          ) : (
            <>
              <Link to="/signin" className="font-semibold text-link hover:underline">
                Sign in
              </Link>{" "}
              for saved delivery addresses
            </>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
            <span className="font-semibold text-foreground">Delivery in Ghana</span>
            {" · "}
            Fees and windows depend on the seller and your area. Confirmed at checkout.
            Supported lab payment: <span className="font-semibold text-foreground">cash on delivery</span>.
          </div>

          {isLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading cart">
              <span className="sr-only">Loading your cart…</span>
              <LineItem loading />
              <LineItem loading />
              <LineItem loading />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center shadow-sm">
              <p className="text-lg font-bold text-foreground">Your cart is empty</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Browse departments or search for products from Ghana sellers.
              </p>
              <Link
                to="/browse/$slug"
                params={{ slug: "all" }}
                className="mt-1 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
              >
                Continue shopping
              </Link>
            </div>
          ) : (
            items.map((line) => (
              <LineItem
                key={line.id}
                title={line.product.title}
                vendorName={line.product.vendorName}
                now={pesewasToPrice(line.product.pricePesewas)}
                was={
                  line.product.compareAtPesewas
                    ? pesewasToPrice(line.product.compareAtPesewas)
                    : undefined
                }
                imageUrl={line.product.imageUrl}
                qty={line.qty}
                qtyPending={updateCartItem.isPending || removeCartItem.isPending}
                onIncrease={() =>
                  updateCartItem.mutate({ id: line.id, data: { qty: line.qty + 1 } })
                }
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
        </div>

        <aside className="space-y-3 lg:sticky lg:top-32 lg:h-max">
          <OrderSummaryCard
            itemCount={itemCount}
            subtotal={pesewasToLabel(subtotal)}
            total={pesewasToLabel(subtotal)}
            shipping="At checkout"
            taxes="At checkout"
            ctaTo="/checkout"
            ctaLabel="Continue to checkout"
            ctaDisabled={items.length === 0}
            footerNote="Next: delivery address, then cash on delivery (lab)."
          />
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-foreground">
              Pay at checkout
            </p>
            <p className="text-sm font-semibold text-foreground">Cash on delivery</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Lab-supported path. Mobile Money is not enabled as product checkout.
            </p>
          </div>
        </aside>
      </div>
    </ShopPage>
  );
}
