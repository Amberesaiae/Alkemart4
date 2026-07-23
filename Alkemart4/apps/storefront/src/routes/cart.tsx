import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Price } from "@/components/price"
import { SellerChip } from "@/components/seller-chip"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/skeleton"
import { QtyStepper } from "@/components/qty-stepper"
import {
  groupCartBySeller,
  removeLine,
  retrieveCart,
  updateLineQuantity,
  type CartLine,
} from "@/lib/cart"

function CartErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Cart unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Something went wrong loading your cart."}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/cart")({
  component: CartPage,
  errorComponent: CartErrorComponent,
})

function CartPage() {
  const queryClient = useQueryClient()
  const { data: cart, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["store", "cart"],
    queryFn: () => retrieveCart(),
  })

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["store", "cart"] })

  const updateQty = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) =>
      updateLineQuantity(id, qty),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => removeLine(id),
    onSuccess: invalidate,
  })

  const items = cart?.items ?? []
  const itemCount = items.reduce((s, l) => s + l.quantity, 0)
  const groups = groupCartBySeller(items)
  const multiSeller =
    groups.filter((g) => g.seller?.name).length > 1 ||
    (groups.length > 1 && groups.some((g) => g.seller?.name))

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Cart
        </h1>
        <p className="text-sm text-muted-foreground">
          {itemCount > 0
            ? `${itemCount} item${itemCount === 1 ? "" : "s"}${
                multiSeller ? " from multiple sellers" : ""
              }`
            : "Your cart is empty"}
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading cart">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl lg:w-80" />
        </div>
      ) : null}

      {isError ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-semibold text-destructive">Could not load cart</p>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <EmptyState
          illustration="emptyCart"
          title="Your cart is empty"
          description="Add products from the catalog."
          actionLabel="Browse market"
          actionTo="/"
        />
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            {multiSeller ? (
              <p className="rounded-2xl border border-primary/30 bg-primary/15 px-4 py-3 text-xs leading-relaxed text-foreground">
                Items in this cart come from more than one seller. Shipping
                options are chosen per seller at checkout.
              </p>
            ) : null}

            {groups.map((group) => (
              <section
                key={group.key}
                className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                  {group.seller?.name ? (
                    <SellerChip seller={group.seller} className="text-sm" />
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Items
                      {!group.seller ? " (seller not on cart line)" : ""}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {group.items.reduce((s, l) => s + l.quantity, 0)} item
                    {group.items.reduce((s, l) => s + l.quantity, 0) === 1
                      ? ""
                      : "s"}
                  </span>
                </div>
                <ul className="space-y-3">
                  {group.items.map((line) => (
                    <CartLineRow
                      key={line.id}
                      line={line}
                      busy={updateQty.isPending || remove.isPending}
                      onDec={() =>
                        updateQty.mutate({
                          id: line.id,
                          qty: line.quantity - 1,
                        })
                      }
                      onInc={() =>
                        updateQty.mutate({
                          id: line.id,
                          qty: line.quantity + 1,
                        })
                      }
                      onRemove={() => remove.mutate(line.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <aside className="h-max space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-24">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Order summary
            </p>
            <Price
              amount={cart?.total}
              currencyCode={cart?.currencyCode}
              size="lg"
              className="text-2xl font-bold"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Shipping calculated at checkout from seller options. Cash on
              delivery available.
            </p>
            <Button
              asChild
              size="lg"
              className="hidden min-h-12 w-full rounded-full font-bold md:inline-flex"
            >
              <Link to="/checkout">Place order</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-11 w-full rounded-full"
            >
              <Link to="/categories/$slug" params={{ slug: "all" }}>
                Continue shopping
              </Link>
            </Button>
          </aside>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card p-3 md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <span className="text-muted-foreground">Total </span>
              <Price
                amount={cart?.total}
                currencyCode={cart?.currencyCode}
                size="sm"
              />
            </div>
            <Button
              asChild
              size="lg"
              className="min-h-11 shrink-0 rounded-full font-bold"
            >
              <Link to="/checkout">Place order</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CartLineRow(props: {
  line: CartLine
  busy: boolean
  onDec: () => void
  onInc: () => void
  onRemove: () => void
}) {
  const { line } = props
  const title = line.productId ? (
    <Link
      to="/product/$id"
      params={{ id: line.productId }}
      className="font-semibold text-foreground hover:underline"
    >
      {line.title}
    </Link>
  ) : (
    <p className="font-semibold text-foreground">{line.title}</p>
  )

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/80 bg-background p-3 sm:p-4">
      {line.thumbnail ? (
        <img
          src={line.thumbnail}
          alt=""
          className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover bg-muted"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-muted text-[10px] text-muted-foreground">
          —
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        {title}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Price
            amount={line.unitPrice}
            currencyCode={line.currencyCode}
            size="sm"
          />
          {line.unitPrice != null && line.quantity > 1 ? (
            <span className="text-xs text-muted-foreground">
              line{" "}
              <Price
                amount={line.unitPrice * line.quantity}
                currencyCode={line.currencyCode}
                size="sm"
              />
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <QtyStepper
          value={line.quantity}
          onChange={(n) => {
            if (n < line.quantity) props.onDec()
            else if (n > line.quantity) props.onInc()
          }}
          disabled={props.busy}
          size="sm"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={props.busy}
          onClick={props.onRemove}
        >
          Remove
        </Button>
      </div>
    </li>
  )
}
