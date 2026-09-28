import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, PackageIcon } from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState, ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { useSession } from "@/hooks/use-store"
import { formatMoney } from "@/lib/market"
import { listMyOrders, maskOrderId, type StoreOrder } from "@/lib/orders"

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
  const session = useSession()
  const ordersQ = useQuery({ queryKey: ["store", "orders"], queryFn: listMyOrders, enabled: Boolean(session.data?.emailVerified) })

  return (
    <div className="container-page max-w-3xl space-y-8 pt-6">
      <PageSeo title="Orders" noindex />
      <header>
        <h1 className="text-3xl font-extrabold">Orders</h1>
        <p className="mt-1 text-muted-foreground">Track deliveries and find past orders.</p>
      </header>

      {session.data?.emailVerified ? (
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
      ) : session.data && !session.data.emailVerified ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface p-5">
          <p className="text-sm">Verify your email to view and manage orders.</p>
          <Button asChild><Link to="/verify-email" search={{ redirect: "/orders" }}>Verify email</Link></Button>
        </div>
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

    </div>
  )
}
