import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, PackageIcon } from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState, ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { useSession } from "@/hooks/use-store"
import { lookupEmail } from "@/lib/checkout-session"
import { formatMoney } from "@/lib/market"
import { listMyOrders, maskOrderId, type StoreOrder } from "@/lib/orders"
import { listRecentOrderIds } from "@/lib/recent-orders"

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
})

const STATUS: Record<string, { label: string; tone: string }> = {
  placed: { label: "Processing", tone: "bg-muted text-foreground" },
  shipped: { label: "On the way", tone: "bg-brand text-brand-foreground" },
  delivered: { label: "Delivered", tone: "bg-success-soft text-success" },
  cancelled: { label: "Cancelled", tone: "bg-destructive/10 text-destructive" },
}

function OrderCard({ order }: { order: StoreOrder }) {
  const s = STATUS[order.fulfillmentStatus] ?? STATUS.placed!
  const sellers = order.sellerOrders.map((o) => o.seller?.name).filter(Boolean)
  return (
    <Link
      to="/order/$id"
      params={{ id: order.id }}
      className="flex items-center gap-4 rounded-3xl border border-border p-4 transition-shadow hover:shadow-lift sm:p-5"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface">
        <HugeiconsIcon icon={PackageIcon} className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold tabular">{maskOrderId(order.id)}</p>
          <Badge className={s.tone}>{s.label}</Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {order.items.length} item{order.items.length === 1 ? "" : "s"}
          {sellers.length ? ` · ${sellers.join(", ")}` : ""}
          {order.createdAt ? ` · ${new Date(order.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}` : ""}
        </p>
      </div>
      <span className="font-semibold tabular">{formatMoney(order.total, order.currencyCode)}</span>
      <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 text-muted-foreground" />
    </Link>
  )
}

function OrdersPage() {
  const navigate = useNavigate()
  const session = useSession()
  const [ref, setRef] = useState("")
  const [email, setEmail] = useState(() => lookupEmail.get() ?? "")
  const [recent] = useState(() => listRecentOrderIds())
  const ordersQ = useQuery({ queryKey: ["store", "orders"], queryFn: listMyOrders, enabled: Boolean(session.data) })

  return (
    <div className="container-page max-w-3xl space-y-8 pt-6">
      <PageSeo title="Orders" noindex />
      <header>
        <h1 className="text-3xl font-extrabold">Orders</h1>
        <p className="mt-1 text-muted-foreground">Track deliveries and find past orders.</p>
      </header>

      {session.data ? (
        <section className="space-y-3">
          {ordersQ.isLoading ? (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 rounded-3xl" />)
          ) : ordersQ.isError ? (
            <ErrorState error={ordersQ.error} onRetry={() => void ordersQ.refetch()} />
          ) : ordersQ.data?.length ? (
            ordersQ.data.map((o) => <OrderCard key={o.id} order={o} />)
          ) : (
            <EmptyState
              icon={PackageIcon}
              illustration="empty-orders"
              title="No orders yet"
              description="Orders you place while signed in show up here."
              action={{ label: "Start shopping", to: "/" }}
            />
          )}
        </section>
      ) : !session.isLoading ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface p-5">
          <p className="text-sm">
            <span className="font-semibold">Have an account?</span>{" "}
            <span className="text-muted-foreground">Sign in to see all your orders in one place.</span>
          </p>
          <Button asChild>
            <Link to="/login" search={{ redirect: "/orders" }}>Sign in</Link>
          </Button>
        </div>
      ) : null}

      <section className="space-y-4 rounded-3xl border border-border p-5 sm:p-6">
        <div>
          <h2 className="font-bold">Find an order</h2>
          <p className="text-sm text-muted-foreground">Use the reference from your confirmation and the email you checked out with.</p>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            if (!ref.trim()) return
            if (email.trim()) lookupEmail.set(email.trim())
            void navigate({ to: "/order/$id", params: { id: ref.trim() } })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ref">Order reference</Label>
            <Input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" spellCheck={false} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="em">Checkout email</Label>
            <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <Button type="submit" disabled={!ref.trim()}>Find order</Button>
        </form>
        {recent.length ? (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">On this device</p>
            <div className="flex flex-wrap gap-2">
              {recent.map((id) => (
                <Button key={id} asChild variant="secondary" size="sm">
                  <Link to="/order/$id" params={{ id }}>{maskOrderId(id)}</Link>
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
