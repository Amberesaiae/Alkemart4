import { useMemo, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQueries } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  CustomerSupportIcon,
  Delete02Icon,
  SecurityCheckIcon,
  ShoppingCart01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Price } from "@/components/commerce/price"
import { QtyStepper } from "@/components/commerce/qty-stepper"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import { RecentlyViewed } from "@/components/commerce/recently-viewed"
import { EmptyState, ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { qk, useCart, useCartLineMutations } from "@/hooks/use-store"
import { groupCartBySeller, type CartLine } from "@/lib/cart"
import { formatMoney, useMarket } from "@/lib/market"
import { getStoreProduct, productParam, type StoreProductCard } from "@/lib/products"
import { thumbFallback } from "@alkemart/shared/media"

export const Route = createFileRoute("/cart")({
  component: CartPage,
})

/** "256GB · Natural Titanium" for the line's own offer, from the product's combos. */
function variantLabel(product: StoreProductCard | undefined, offerId?: string | null): string | null {
  const combo = product?.combos?.find((c) => c.offerId === offerId)
  const values = combo ? Object.values(combo.options).filter(Boolean) : []
  return values.length ? values.join(" · ") : null
}

function CartPage() {
  const market = useMarket()
  const [confirmClear, setConfirmClear] = useState(false)
  const cartQ = useCart()
  const cart = cartQ.data
  const items = useMemo(() => cart?.items ?? [], [cart])
  const { setQty, remove, clear } = useCartLineMutations()
  const busy = setQty.isPending || remove.isPending || clear.isPending

  // Line art + variant names come from the product (cached with the PDP).
  const productIds = useMemo(() => [...new Set(items.map((i) => i.productId).filter(Boolean) as string[])], [items])
  const productQs = useQueries({
    queries: productIds.map((id) => ({ queryKey: qk.product(id), queryFn: () => getStoreProduct(id), staleTime: 300_000 })),
  })
  const products = new Map(productQs.flatMap((q) => (q.data ? [[q.data.id, q.data] as const] : [])))
  const groups = groupCartBySeller(items)
  const count = items.reduce((s, l) => s + l.quantity, 0)

  if (cartQ.isLoading) {
    return (
      <div className="container-page grid gap-8 pt-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="space-y-12 pt-4 pb-32 sm:pt-6 lg:pb-0">
      <PageSeo title="Cart" noindex />
      <div className="container-page">
        {cartQ.isError ? (
          <ErrorState title="Your cart didn't load" error={cartQ.error} onRetry={() => void cartQ.refetch()} />
        ) : items.length === 0 ? (
          <>
          <h1 className="sr-only">Cart</h1>
          <EmptyState
            icon={ShoppingCart01Icon}
            illustration="empty-cart"
            title="Your cart is empty"
            description="Find something you love and add it here."
            action={{ label: "Start shopping", to: "/" }}
          />
          </>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
            <div className="space-y-5">
              <div className="flex items-end justify-between">
                <h1 className="text-3xl font-extrabold">
                  My cart <span className="text-muted-foreground">({count} item{count === 1 ? "" : "s"})</span>
                </h1>
                {confirmClear ? (
                  <span className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">Remove all items?</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setConfirmClear(false)
                        clear.mutate(items.map((l) => l.id))
                      }}
                      className="font-semibold text-destructive hover:underline disabled:opacity-50"
                    >
                      Yes
                    </button>
                    <button type="button" onClick={() => setConfirmClear(false)} className="font-semibold hover:underline">
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmClear(true)}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                  >
                    Clear cart
                  </button>
                )}
              </div>
              {groups.length > 1 ? (
                <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted-foreground">
                  Your items come from {groups.length} sellers. Each ships separately with its own delivery fee.
                </p>
              ) : null}

              {groups.map((g) => {
                const sellerId = g.seller?.id ?? ""
                const fee = cart?.deliveryBySeller[sellerId]
                const n = g.items.reduce((s, l) => s + l.quantity, 0)
                return (
                  <section key={g.key} className="overflow-hidden rounded-3xl border border-border">
                    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-5">
                      <div className="flex items-center gap-2.5">
                        {g.seller?.name ? <SellerAvatar name={g.seller.name} size="sm" /> : null}
                        {g.seller?.handle ? (
                          <Link to="/shops/$slug" params={{ slug: g.seller.handle }} className="font-semibold hover:underline">
                            {g.seller.name}
                          </Link>
                        ) : (
                          <span className="font-semibold">{g.seller?.name ?? "Items"}</span>
                        )}
                        <span className="text-sm text-muted-foreground">
                          ({n} item{n === 1 ? "" : "s"})
                        </span>
                      </div>
                      {fee != null ? (
                        <span className="text-xs text-muted-foreground">
                          Delivery {fee === 0 ? "free" : formatMoney(fee, cart?.currencyCode)}
                        </span>
                      ) : null}
                    </header>
                    <ul className="divide-y divide-border">
                      {g.items.map((line) => (
                        <CartRow
                          key={line.id}
                          line={line}
                          product={line.productId ? products.get(line.productId) : undefined}
                          busy={busy}
                          onQty={(qty) => setQty.mutate({ lineId: line.id, qty })}
                          onRemove={() => remove.mutate(line.id)}
                        />
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24">
              <div className="space-y-4 rounded-3xl border border-border p-5 sm:p-6">
                <h2 className="text-lg font-bold">Order summary</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Items ({count})</dt>
                    <dd className="tabular">{formatMoney(cart?.itemTotal, cart?.currencyCode)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery</dt>
                    <dd className="tabular">
                      {cart?.shippingTotal == null ? "At checkout" : cart.shippingTotal === 0 ? "Free" : formatMoney(cart.shippingTotal, cart.currencyCode)}
                    </dd>
                  </div>
                  <Separator />
                  <div className="flex items-baseline justify-between">
                    <dt className="font-semibold">Total</dt>
                    <dd>
                      <Price amount={cart?.total} currency={cart?.currencyCode} size="lg" />
                    </dd>
                  </div>
                </dl>
                {/* Phones use the sticky checkout bar — one button, not two. */}
                <Button asChild variant="brand" size="xl" className="hidden w-full lg:inline-flex">
                  <Link to="/checkout">
                    Proceed to checkout <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
                  </Link>
                </Button>
                <p className="text-center text-xs text-muted-foreground">You'll confirm delivery details for each seller at checkout.</p>
              </div>
              <ul className="space-y-2.5 px-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <HugeiconsIcon icon={SecurityCheckIcon} className="size-5 text-foreground" /> Secure checkout
                </li>
                {market.paymentMethods.includes("cod") ? (
                  <li className="flex items-center gap-2.5">
                    <HugeiconsIcon icon={Wallet01Icon} className="size-5 text-foreground" /> Pay on delivery available
                  </li>
                ) : null}
                <li className="flex items-center gap-2.5">
                  <HugeiconsIcon icon={CustomerSupportIcon} className="size-5 text-foreground" />
                  <Link to="/help" className="hover:underline">Support when you need it</Link>
                </li>
              </ul>
            </aside>
          </div>
        )}
      </div>

      {items.length === 0 && !cartQ.isLoading ? <RecentlyViewed /> : null}

      {items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-safe backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Total</p>
              <Price amount={cart?.total} currency={cart?.currencyCode} size="lg" />
            </div>
            <Button asChild variant="brand" size="xl">
              <Link to="/checkout">Checkout</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CartRow({
  line,
  product,
  busy,
  onQty,
  onRemove,
}: {
  line: CartLine
  product?: StoreProductCard
  busy: boolean
  onQty: (qty: number) => void
  onRemove: () => void
}) {
  const image = product?.thumbUrl ?? product?.thumbnail
  const variant = variantLabel(product, line.offerId)
  const stock = product?.combos?.find((c) => c.offerId === line.offerId)?.availableQty
  const title = product ? (
    <Link to="/product/$id" params={{ id: productParam(product) }} className="line-clamp-2 font-semibold hover:underline">
      {line.title}
    </Link>
  ) : (
    <span className="line-clamp-2 font-semibold">{line.title}</span>
  )
  return (
    <li className="flex gap-4 p-4 sm:p-5">
      <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-surface sm:size-24">
        {image ? <img src={image} alt="" className="size-full object-contain p-2 mix-blend-multiply" loading="lazy" onError={thumbFallback(product?.thumbnail)} /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title}
            {variant ? <p className="text-sm text-muted-foreground">{variant}</p> : null}
          </div>
          <Price amount={line.unitPrice != null ? line.unitPrice * line.quantity : null} currency={line.currencyCode} />
        </div>
        {line.dealApplied ? (
          <p className="text-xs font-semibold text-success">
            Your offer price{line.listUnitPrice != null ? ` (was ${formatMoney(line.listUnitPrice * line.quantity, line.currencyCode)})` : ""}
          </p>
        ) : null}
        {line.quantity > 1 && line.unitPrice != null ? (
          <p className="text-xs text-muted-foreground tabular">{formatMoney(line.unitPrice, line.currencyCode)} each</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <QtyStepper
            size="sm"
            value={line.quantity}
            onChange={onQty}
            disabled={busy}
            max={stock ?? null}
          />
          <Button variant="ghost" size="icon" aria-label={`Remove ${line.title}`} disabled={busy} onClick={onRemove}>
            <HugeiconsIcon icon={Delete02Icon} className="text-destructive" />
          </Button>
        </div>
      </div>
    </li>
  )
}
