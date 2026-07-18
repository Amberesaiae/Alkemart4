import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { formatOrderLabel, listMyOrders } from "@/lib/orders"
import { getSessionCustomer } from "@/lib/auth"
import { listRecentOrderIds } from "@/lib/recent-orders"
import { Skeleton } from "@/components/skeleton"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { Price } from "@/components/price"
import { formInputClassName } from "@/components/form-field"
import { requireAuth } from "@/lib/route-guards"

function OrdersPendingComponent() {
  return (
    <div className="mx-auto max-w-2xl space-y-8" role="status" aria-label="Loading orders">
      <Skeleton className="h-28 w-full rounded-3xl" />
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/orders")({
  beforeLoad: async () => {
    const customer = await requireAuth()
    return { customer }
  },
  component: OrdersPage,
  pendingComponent: OrdersPendingComponent,
})

function OrdersPage() {
  const navigate = useNavigate()
  const [lookupId, setLookupId] = useState("")
  const [recentIds] = useState(() => listRecentOrderIds())

  const session = useQuery({
    queryKey: ["store", "session"],
    queryFn: () => getSessionCustomer(),
  })
  const ordersQ = useQuery({
    queryKey: ["store", "orders"],
    queryFn: () => listMyOrders(),
    enabled: Boolean(session.data),
  })

  function goToOrder(raw: string) {
    const id = raw.trim()
    if (!id) return
    void navigate({
      to: "/order/$id",
      params: { id },
      search: {},
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Account
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Signed-in order history, or look up a guest order with the id from
          checkout.
        </p>
      </header>

      <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h2 className="text-base font-bold">Find an order</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste the order id from your confirmation page.
          </p>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            goToOrder(lookupId)
          }}
        >
          <input
            type="text"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="order_…"
            className={formInputClassName("font-mono")}
            aria-label="Order id"
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="submit"
            className="min-h-11 shrink-0 rounded-xl px-6"
            disabled={!lookupId.trim()}
          >
            Open
          </Button>
        </form>
        {recentIds.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Recent on this device
            </p>
            <ul className="space-y-2">
              {recentIds.map((rid) => (
                <li key={rid}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-left font-mono text-xs transition hover:border-primary/40 hover:bg-muted/40"
                    onClick={() => goToOrder(rid)}
                  >
                    {rid}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {!session.isLoading && !session.data ? (
        <EmptyState
          illustration="emptyOrders"
          title="Sign in for account orders"
          description="Orders linked to your customer appear here after you sign in. Guest checkouts stay available via the order id above."
          actionLabel="Sign in"
          actionTo="/signin"
          actionSearch={{ redirect: "/orders" }}
        />
      ) : null}

      {session.data ? (
        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight">Your orders</h2>

          {ordersQ.isLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading orders">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : null}

          {ordersQ.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {ordersQ.error instanceof Error
                ? ordersQ.error.message
                : "Could not load orders"}
            </p>
          ) : null}

          {ordersQ.data && ordersQ.data.length === 0 ? (
            <EmptyState
              illustration="emptyOrders"
              title="No orders yet"
              description="When you place a COD order while signed in, it will show up here."
              actionLabel="Browse market"
              actionTo="/"
            />
          ) : null}

          <ul className="space-y-3">
            {ordersQ.data?.map((o) => (
              <li key={o.id}>
                <Link
                  to="/order/$id"
                  params={{ id: o.id }}
                  search={{}}
                  className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="text-lg font-bold tracking-tight">
                        {formatOrderLabel(o)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 font-medium capitalize text-foreground">
                          {o.status}
                        </span>
                        {o.createdAt
                          ? ` · ${new Date(o.createdAt).toLocaleDateString()}`
                          : ""}
                      </p>
                      {o.items.length > 0 ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {o.items
                            .map((i) => `${i.title} × ${i.quantity}`)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <Price
                        amount={o.total}
                        currencyCode={o.currencyCode}
                        size="md"
                      />
                      {o.shippingAddress?.city ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {o.shippingAddress.city}
                        </p>
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
