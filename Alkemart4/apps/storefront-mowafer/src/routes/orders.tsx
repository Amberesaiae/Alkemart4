import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Button, Input, MerchEmpty, Price } from "@workspace/ui"
import { formatOrderLabel, listMyOrders, maskOrderId } from "@/lib/orders"
import { getSessionCustomer } from "@/lib/auth"
import { listRecentOrderIds } from "@/lib/recent-orders"
import { OrderCardSkeleton } from "@/components/skeletons"
import { normalizeCurrencyCode } from "@/lib/money"

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
})

function OrdersPage() {
  const navigate = useNavigate()
  const [lookupId, setLookupId] = useState("")
  const [lookupEmail, setLookupEmail] = useState("")
  const [recentIds] = useState(() => listRecentOrderIds())

  const session = useQuery({
    queryKey: ["store", "session"],
    queryFn: () => getSessionCustomer(),
  })
  const ordersQ = useQuery({
    queryKey: ["store", "orders"],
    queryFn: () => listMyOrders(),
    enabled: Boolean(session.data),
    retry: false,
  })

  function goToOrder(raw: string, email?: string) {
    const id = raw.trim()
    if (!id) return
    try {
      if (email?.trim()) sessionStorage.setItem("alkemart.storefront.order_lookup_email", email.trim())
    } catch {
      /* private mode */
    }
    void navigate({ to: "/order/$id", params: { id }, search: {} })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Track orders</h1>
        <p className="text-sm text-muted-foreground">
          Sign in for account history, or look up a guest order with your reference and checkout email.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h2 className="text-base font-bold">Find an order</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the reference from your confirmation. Guests also need the checkout email.
          </p>
        </div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            goToOrder(lookupId, lookupEmail)
          }}
        >
          <Input
            type="text"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Order reference"
            className="min-h-11 rounded-xl"
            aria-label="Order reference"
            autoComplete="off"
            spellCheck={false}
          />
          <Input
            type="email"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            placeholder="Checkout email"
            className="min-h-11 rounded-xl"
            aria-label="Checkout email"
            autoComplete="email"
          />
          <Button type="submit" className="min-h-11 w-full rounded-full" disabled={!lookupId.trim()}>
            Open
          </Button>
        </form>
        {recentIds.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Recent on this device</p>
            <ul className="space-y-2">
              {recentIds.map((rid) => (
                <li key={rid}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start rounded-xl px-3 py-2.5 font-medium"
                    onClick={() => goToOrder(rid)}
                  >
                    {maskOrderId(rid)}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {!session.isLoading && !session.data ? (
        <MerchEmpty
          title="Sign in for account orders"
          body="Sign in to see your orders. Guests can look up by order id."
          action={
            <Button className="rounded-full" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          }
        />
      ) : null}

      {session.data ? (
        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight">Your orders</h2>
          {ordersQ.isLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading orders">
              <OrderCardSkeleton />
              <OrderCardSkeleton />
              <OrderCardSkeleton />
            </div>
          ) : null}
          {ordersQ.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {ordersQ.error instanceof Error ? ordersQ.error.message : "Could not load orders"}
            </p>
          ) : null}
          {ordersQ.data && ordersQ.data.length === 0 ? (
            <MerchEmpty
              title="No orders yet"
              body="Orders you place while signed in show here."
              action={
                <Button className="rounded-full" asChild>
                  <Link to="/">Browse market</Link>
                </Button>
              }
            />
          ) : null}
          <ul className="space-y-3">
            {ordersQ.data?.map((o) => (
              <li key={o.id}>
                <Link
                  to="/order/$id"
                  params={{ id: o.id }}
                  search={{}}
                  className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="text-lg font-bold tracking-tight">{formatOrderLabel(o)}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 font-medium capitalize">
                          {o.status}
                        </span>
                        {o.createdAt ? ` · ${new Date(o.createdAt).toLocaleDateString()}` : ""}
                      </p>
                      {o.items.length > 0 ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {o.items.map((i) => `${i.title} × ${i.quantity}`).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <Price amount={o.total} currency={normalizeCurrencyCode(o.currencyCode)} size="md" />
                      {o.shippingAddress?.city ? (
                        <p className="mt-1 text-xs text-muted-foreground">{o.shippingAddress.city}</p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
