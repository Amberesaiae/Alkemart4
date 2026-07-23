import { useEffect, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Price } from "@/components/price"
import { SellerChip } from "@/components/seller-chip"
import { Skeleton } from "@/components/skeleton"
import { formInputClassName } from "@/components/form-field"
import {
  formatAddressLines,
  formatOrderLabel,
  getOrder,
  groupOrderItemsBySeller,
  maskEmail,
  maskOrderId,
  orderSupportReference,
} from "@/lib/orders"
import { rememberOrderId } from "@/lib/recent-orders"
import { CopyButton } from "@/components/copy-button"
import { Illustration } from "@/components/illustration"

const EMAIL_KEY = "alkemart.storefront.order_lookup_email"

export type OrderSearch = {
  placed?: string
  pay?: string
  /** @deprecated email must not appear in URLs — use sessionStorage */
  email?: string
}

export const Route = createFileRoute("/order/$id")({
  validateSearch: (search: Record<string, unknown>): OrderSearch => {
    const out: OrderSearch = {}
    if (typeof search.placed === "string") out.placed = search.placed
    if (typeof search.pay === "string") out.pay = search.pay
    // Accept legacy ?email= once, then prefer storage (do not re-emit to URL)
    if (typeof search.email === "string") out.email = search.email
    return out
  },
  component: OrderDetailPage,
})

function readStoredEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY)?.trim() || ""
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
  const { placed, pay, email: emailFromSearch } = Route.useSearch()
  const justPlaced = placed === "1"
  const paidMomo = pay === "momo"
  const [email, setEmail] = useState(
    () => emailFromSearch?.trim() || readStoredEmail(),
  )
  const [submittedEmail, setSubmittedEmail] = useState(
    () => emailFromSearch?.trim() || readStoredEmail(),
  )

  // Prefer sessionStorage; absorb legacy ?email= then drop it from the bar
  useEffect(() => {
    const fromSearch = emailFromSearch?.trim()
    if (fromSearch) {
      writeStoredEmail(fromSearch)
      try {
        sessionStorage.setItem(EMAIL_KEY, fromSearch)
      } catch {
        /* */
      }
    }
  }, [emailFromSearch])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["store", "order", id, submittedEmail || ""],
    queryFn: () =>
      getOrder(id, {
        email: submittedEmail || undefined,
      }),
    retry: false,
  })

  useEffect(() => {
    if (data?.id) rememberOrderId(data.id)
  }, [data?.id])

  const groups = data ? groupOrderItemsBySeller(data.items) : []
  const multiSeller =
    groups.filter((g) => g.seller?.name).length > 1 ||
    (groups.length > 1 && groups.some((g) => g.seller?.name))
  const addrLines = data?.shippingAddress
    ? formatAddressLines(data.shippingAddress)
    : []

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      {!justPlaced ? (
        <nav className="text-xs text-muted-foreground">
          <Link to="/orders" className="hover:underline">
            Orders
          </Link>
          <span className="mx-1">/</span>
          <span className="font-medium text-foreground">
            {data ? formatOrderLabel(data) : "Detail"}
          </span>
        </nav>
      ) : null}

      {justPlaced ? (
        <section
          className="overflow-hidden rounded-3xl border border-primary/30 bg-primary/15 p-6 sm:p-8"
          aria-live="polite"
        >
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Illustration name="orderSuccess" size="md" className="mx-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70">
                Success
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Order placed
              </h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {paidMomo
                  ? "Mobile Money payment confirmed. Save your order reference below."
                  : "Cash on delivery — pay when you receive your items. Save your order reference below."}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading order">
          <Skeleton className="h-28 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : null}

      {isError ? (
        <div
          role="alert"
          className="space-y-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-sm"
        >
          <div className="space-y-2">
            <p className="font-semibold text-destructive">
              {error instanceof Error
                ? error.message
                : "Order not found or not accessible"}
            </p>
            {justPlaced ? (
              <p className="text-muted-foreground">
                Confirm with the same email used at checkout.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Orders are private. Sign in, or verify with your checkout email.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Reference {maskOrderId(id)}
            </p>
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
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Checkout email
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={formInputClassName()}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                size="lg"
                className="min-h-11 rounded-xl"
                disabled={!email.trim() || isFetching}
              >
                {isFetching ? "Looking up…" : "View order"}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="min-h-11 rounded-xl"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                Retry
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {!isLoading && !isError && !data && !submittedEmail ? (
        <form
          className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            const next = email.trim()
            if (!next) return
            writeStoredEmail(next)
            setSubmittedEmail(next)
          }}
        >
          <h2 className="text-lg font-bold tracking-tight">
            Look up this order
          </h2>
          <p className="text-sm text-muted-foreground">
            Enter the email used at checkout to open order details.
          </p>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Checkout email
            </span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={formInputClassName()}
            />
          </label>
          <Button
            type="submit"
            size="lg"
            className="min-h-11 w-full rounded-xl sm:w-auto"
            disabled={!email.trim() || isFetching}
          >
            {isFetching ? "Looking up…" : "View order"}
          </Button>
        </form>
      ) : null}

      {data ? (
        <>
          <header className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            {!justPlaced ? (
              <h1 className="text-3xl font-bold tracking-tight">
                {formatOrderLabel(data)}
              </h1>
            ) : (
              <p className="text-xl font-bold">{formatOrderLabel(data)}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              <StatusPill label={data.status} />
              {data.paymentStatus ? (
                <StatusPill label={`Payment: ${data.paymentStatus}`} />
              ) : null}
              {data.fulfillmentStatus ? (
                <StatusPill label={`Fulfillment: ${data.fulfillmentStatus}`} />
              ) : null}
            </div>
            {data.createdAt ? (
              <p className="text-xs text-muted-foreground">
                {new Date(data.createdAt).toLocaleString()}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-xl bg-muted px-3 py-1.5 text-sm font-semibold tabular-nums">
                {formatOrderLabel(data)}
              </span>
              <CopyButton
                value={orderSupportReference(data)}
                label="Copy reference"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Save your order number for support. We never show full system ids
              on shared screens.
            </p>
          </header>

          <div className="space-y-2 rounded-3xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Totals
            </p>
            <Price
              amount={data.total}
              currencyCode={data.currencyCode}
              size="lg"
              className="text-2xl"
            />
            {data.itemTotal != null || data.shippingTotal != null ? (
              <dl className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
                {data.itemTotal != null ? (
                  <div className="flex justify-between gap-2">
                    <dt>Items</dt>
                    <dd>
                      <Price
                        amount={data.itemTotal}
                        currencyCode={data.currencyCode}
                        size="sm"
                      />
                    </dd>
                  </div>
                ) : null}
                {data.shippingTotal != null ? (
                  <div className="flex justify-between gap-2">
                    <dt>Shipping</dt>
                    <dd>
                      <Price
                        amount={data.shippingTotal}
                        currencyCode={data.currencyCode}
                        size="sm"
                      />
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <p className="pt-2 text-sm text-muted-foreground">
              Payment: cash on delivery
              {data.paymentStatus === "captured" ||
              data.paymentStatus === "paid"
                ? " (marked paid by platform)"
                : " — pay the rider"}
            </p>
          </div>

          {addrLines.length > 0 ? (
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-bold">Delivery</h2>
              <address className="space-y-0.5 not-italic text-sm text-muted-foreground">
                {addrLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </address>
              {data.email ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Confirmation sent to {maskEmail(data.email)}
                </p>
              ) : null}
            </section>
          ) : data.shippingAddress?.city ? (
            <p className="text-sm text-muted-foreground">
              Deliver to {data.shippingAddress.city}
            </p>
          ) : null}

          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight">
              Items
              {multiSeller ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  (multiple sellers)
                </span>
              ) : null}
            </h2>
            {groups.map((group) => (
              <div
                key={group.key}
                className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-sm"
              >
                {group.seller?.name ? (
                  <SellerChip seller={group.seller} className="text-sm" />
                ) : groups.length > 1 || multiSeller ? (
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Items
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {group.items.map((i) => (
                    <li
                      key={i.id}
                      className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background px-3 py-2.5 text-sm"
                    >
                      {i.thumbnail ? (
                        <img
                          src={i.thumbnail}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover bg-muted"
                        />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        {i.productId ? (
                          <Link
                            to="/product/$id"
                            params={{ id: i.productId }}
                            className="font-semibold hover:underline"
                          >
                            {i.title}
                          </Link>
                        ) : (
                          <span className="font-semibold">{i.title}</span>
                        )}{" "}
                        <span className="text-muted-foreground">
                          × {i.quantity}
                        </span>
                      </span>
                      <Price
                        amount={i.unitPrice}
                        currencyCode={data.currencyCode}
                        size="sm"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="min-h-12 flex-1 rounded-xl">
              <Link to="/">Continue shopping</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-12 flex-1 rounded-xl"
            >
              <Link to="/orders">Your orders</Link>
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full bg-muted px-2.5 py-1 font-medium capitalize text-foreground">
      {label}
    </span>
  )
}
