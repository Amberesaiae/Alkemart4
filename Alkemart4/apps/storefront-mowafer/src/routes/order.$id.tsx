import { useEffect, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Button, Input, Price } from "@workspace/ui"
import { OrderCardSkeleton, ProductGridSkeleton } from "@/components/skeletons"
import {
  formatAddressLines,
  formatOrderLabel,
  getOrder,
  groupOrderItemsBySeller,
  maskEmail,
  maskOrderId,
} from "@/lib/orders"
import { getSessionCustomer } from "@/lib/auth"
import { rememberOrderId } from "@/lib/recent-orders"
import { normalizeCurrencyCode } from "@/lib/money"

const EMAIL_KEY = "alkemart.storefront.order_lookup_email"

export const Route = createFileRoute("/order/$id")({
  component: OrderDetailPage,
})

function readStoredEmail(): string {
  try {
    return sessionStorage.getItem(EMAIL_KEY)?.trim() || localStorage.getItem(EMAIL_KEY)?.trim() || ""
  } catch {
    return ""
  }
}

function writeStoredEmail(email: string) {
  try {
    if (email.trim()) localStorage.setItem(EMAIL_KEY, email.trim())
  } catch {
    /* ignore */
  }
}

function OrderDetailPage() {
  const { id } = Route.useParams()
  const [email, setEmail] = useState(() => readStoredEmail())
  const [submittedEmail, setSubmittedEmail] = useState(() => readStoredEmail())

  const sessionQ = useQuery({
    queryKey: ["store", "session"],
    queryFn: () => getSessionCustomer(),
  })

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["store", "order", id, submittedEmail || "", sessionQ.data?.id ?? ""],
    queryFn: () => getOrder(id, { email: submittedEmail || sessionQ.data?.email || undefined }),
    enabled: Boolean(submittedEmail || sessionQ.data?.email),
    retry: false,
  })

  useEffect(() => {
    if (data?.id) rememberOrderId(data.id)
  }, [data?.id])

  const groups = data ? groupOrderItemsBySeller(data.items) : []
  const multiSeller = groups.filter((g) => g.seller?.name).length > 1 || groups.length > 1
  const addrLines = data?.shippingAddress ? formatAddressLines(data.shippingAddress) : []

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <nav className="text-xs text-muted-foreground">
        <Link to="/orders" className="hover:underline">
          Orders
        </Link>
        <span className="mx-1">/</span>
        <span className="font-medium text-foreground">{data ? formatOrderLabel(data) : "Detail"}</span>
      </nav>

      {isLoading ? (
        <div className="space-y-3">
          <OrderCardSkeleton />
          <ProductGridSkeleton count={3} view="list" />
        </div>
      ) : null}

      {isError ? (
        <div role="alert" className="space-y-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-sm">
          <div className="space-y-2">
            <p className="font-semibold text-destructive">
              {error instanceof Error ? error.message : "Order not found or not accessible"}
            </p>
            <p className="text-muted-foreground">Orders are private. Sign in, or verify with your checkout email.</p>
            <p className="text-xs text-muted-foreground">Reference {maskOrderId(id)}</p>
          </div>
          <form
            className="space-y-3 rounded-2xl border border-border bg-card p-4"
            onSubmit={(e) => {
              e.preventDefault()
              const next = email.trim()
              if (!next) return
              writeStoredEmail(next)
              setSubmittedEmail(next)
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checkout email</span>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="min-h-11 rounded-xl" />
            </label>
            <Button type="submit" className="min-h-11 w-full rounded-full" disabled={!email.trim() || isFetching}>
              {isFetching ? "Looking up…" : "View order"}
            </Button>
          </form>
        </div>
      ) : null}

      {!isLoading && !isError && !data && !submittedEmail ? (
        <form
          className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            const next = email.trim()
            if (!next) return
            writeStoredEmail(next)
            setSubmittedEmail(next)
          }}
        >
          <h2 className="text-lg font-bold tracking-tight">Look up this order</h2>
          <p className="text-sm text-muted-foreground">Enter the email used at checkout to open order details.</p>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checkout email</span>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="min-h-11 rounded-xl" />
          </label>
          <Button type="submit" className="min-h-11 w-full rounded-full" disabled={!email.trim() || isFetching}>
            {isFetching ? "Looking up…" : "View order"}
          </Button>
        </form>
      ) : null}

      {data ? (
        <>
          <header className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h1 className="text-2xl font-bold tracking-tight">{formatOrderLabel(data)}</h1>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex rounded-full bg-muted px-2.5 py-1 font-medium capitalize">{data.status}</span>
              {data.paymentStatus ? (
                <span className="inline-flex rounded-full bg-muted px-2.5 py-1 font-medium capitalize">
                  Payment: {data.paymentStatus}
                </span>
              ) : null}
              {data.fulfillmentStatus ? (
                <span className="inline-flex rounded-full bg-muted px-2.5 py-1 font-medium capitalize">
                  Fulfillment: {data.fulfillmentStatus}
                </span>
              ) : null}
            </div>
            {data.createdAt ? (
              <p className="text-xs text-muted-foreground">{new Date(data.createdAt).toLocaleString()}</p>
            ) : null}
          </header>

          <div className="space-y-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Totals</p>
            <Price amount={data.total} currency={normalizeCurrencyCode(data.currencyCode)} size="lg" />
            {data.itemTotal != null || data.shippingTotal != null ? (
              <dl className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
                {data.itemTotal != null ? (
                  <div className="flex justify-between gap-2">
                    <dt>Items</dt>
                    <dd>
                      <Price amount={data.itemTotal} currency={normalizeCurrencyCode(data.currencyCode)} size="sm" />
                    </dd>
                  </div>
                ) : null}
                {data.shippingTotal != null ? (
                  <div className="flex justify-between gap-2">
                    <dt>Shipping</dt>
                    <dd>
                      <Price amount={data.shippingTotal} currency={normalizeCurrencyCode(data.currencyCode)} size="sm" />
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>

          {addrLines.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-bold">Delivery</h2>
              <address className="space-y-0.5 text-sm not-italic text-muted-foreground">
                {addrLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </address>
              {data.email ? (
                <p className="mt-3 text-xs text-muted-foreground">Confirmation sent to {maskEmail(data.email)}</p>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight">
              Items
              {multiSeller ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">(multiple sellers)</span>
              ) : null}
            </h2>
            {groups.map((group) => (
              <div key={group.key} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                {group.seller?.name ? (
                  <p className="text-sm font-bold">{group.seller.name}</p>
                ) : null}
                <ul className="space-y-2">
                  {group.items.map((i) => (
                    <li
                      key={i.id}
                      className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1">
                        {i.productId ? (
                          <Link to="/product/$id" params={{ id: i.productId }} className="font-semibold hover:underline">
                            {i.title}
                          </Link>
                        ) : (
                          <span className="font-semibold">{i.title}</span>
                        )}{" "}
                        <span className="text-muted-foreground">× {i.quantity}</span>
                      </span>
                      <Price
                        amount={i.unitPrice}
                        currency={normalizeCurrencyCode(data.currencyCode)}
                        size="sm"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="min-h-11 flex-1 rounded-full">
              <Link to="/">Continue shopping</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 flex-1 rounded-full">
              <Link to="/orders">Your orders</Link>
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
