import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Clock01Icon, DeliveryBox01Icon, Location01Icon } from "@hugeicons/core-free-icons"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/console-ui/components/tabs"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { StatusBadge } from "@workspace/console-ui/components/console/status-badge"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { formatMinor, timeAgo } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { orderReference } from "@alkemart/shared/order-ref"
import type { OrderStatus, OrderSummary } from "@/lib/api"
import { useOrders } from "@/lib/queries"

const TABS = [
  { id: "to-pack", label: "To pack", statuses: ["placed"] },
  { id: "on-the-way", label: "On the way", statuses: ["shipped"] },
  { id: "delivered", label: "Delivered", statuses: ["delivered"] },
  { id: "returns", label: "Returns", statuses: null },
  { id: "all", label: "All", statuses: null },
] as const satisfies readonly { id: string; label: string; statuses: readonly OrderStatus[] | null }[]

/** Open returns (the API sends the latest case per order). */
const hasOpenReturn = (o: OrderSummary) => !!o.returnCase && o.returnCase.status !== "closed"
const inTab = (o: OrderSummary, t: (typeof TABS)[number]) =>
  t.id === "returns" ? hasOpenReturn(o) : !t.statuses || (t.statuses as readonly string[]).includes(o.status)

type Tab = (typeof TABS)[number]["id"]
type Search = { tab?: Tab }

export const Route = createFileRoute("/_app/orders/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: TABS.some((t) => t.id === s.tab) ? (s.tab as Tab) : undefined,
  }),
  component: OrdersPage,
})


/** "3:40 PM" today, otherwise "Sat 3:40 PM". */
function sendBy(at: number, now: number) {
  const d = new Date(at)
  const sameDay = new Date(now).toDateString() === d.toDateString()
  return new Intl.DateTimeFormat(undefined, sameDay ? { hour: "numeric", minute: "2-digit" } : { weekday: "short", hour: "numeric", minute: "2-digit" }).format(d)
}

const PAY: Record<string, string> = { cod: "Pay on delivery", momo: "Paid · mobile money", card: "Paid · card" }

function OrdersPage() {
  const { tab: requested } = Route.useSearch()
  const q = useOrders()
  // One clock per visit keeps render pure; ages refresh on the next visit.
  const [now] = useState(() => Date.now())
  const orders = q.data?.items ?? []
  const count = (t: (typeof TABS)[number]) => orders.filter((o) => inTab(o, t)).length
  // Default: To pack when there's something to pack, otherwise All.
  const tab: Tab = requested ?? (orders.some((o) => o.status === "placed") || q.isPending ? "to-pack" : "all")
  const active = TABS.find((t) => t.id === tab)!
  const rows = orders.filter((o) => inTab(o, active))
  // Packing works oldest first; history reads newest first.
  const sorted = tab === "to-pack" ? [...rows].reverse() : rows

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Pack what's waiting, then mark it sent and delivered." />
      <Tabs value={tab}>
        <TabsList className="grid h-auto w-full grid-cols-5 sm:inline-flex sm:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} asChild className="min-h-11 flex-col gap-0.5 px-1 text-[13px] sm:flex-row sm:px-4 sm:text-[15px]">
              <Link to="/orders" search={{ tab: t.id }} replace>
                {t.label}
                {q.data ? (
                  <span className={cn("rounded-full px-1.5 text-xs font-bold tabular sm:ml-1.5", (t.id === "to-pack" || t.id === "returns") && count(t) > 0 ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground")}>
                    {count(t)}
                  </span>
                ) : null}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {q.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState title="Orders didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={DeliveryBox01Icon}
          illustration="empty-orders"
          title={tab === "to-pack" ? "Nothing to pack" : tab === "on-the-way" ? "Nothing on the way" : tab === "delivered" ? "No delivered orders yet" : tab === "returns" ? "No open returns" : "No orders yet"}
          description={tab === "to-pack" ? "New orders show up here as soon as a buyer checks out." : undefined}
          className="rounded-2xl border bg-card"
        />
      ) : (
        <ul className="space-y-3" aria-label={`${active.label} orders`}>
          {sorted.map((o) => (
            <li key={o.id}>
              <OrderRow order={o} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function OrderRow({ order: o, now }: { order: OrderSummary; now: number }) {
  // Late = past the dispatch deadline frozen at checkout (legacy: 24h).
  const due = o.dispatchBy ? new Date(o.dispatchBy).getTime() : o.placedAt ? new Date(o.placedAt).getTime() + 24 * 3_600_000 : null
  const late = o.status === "placed" && due != null && now > due
  const dueSoon = o.status === "placed" && due != null && !late && due - now < 6 * 3_600_000
  const first = o.items[0]
  const more = o.items.length - 1
  const area = [o.shipTo?.city, o.shipTo?.region].filter(Boolean).join(", ")
  return (
    <Link
      to="/orders/$id"
      params={{ id: o.id }}
      className={cn(
        "flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/25 sm:p-5",
        late && "border-warning/40",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold">Order {orderReference(o.orderGroupId)}</span>
          <StatusBadge kind="order" status={o.status} audience="seller" />
          {hasOpenReturn(o) ? (
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", o.returnCase!.waitingOnYou ? "bg-warning-soft text-foreground" : "bg-muted text-muted-foreground")}>
              {o.returnCase!.waitingOnYou ? "Return — your reply" : "Return open"}
            </span>
          ) : null}
          {o.status === "placed" && due != null ? (
            <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", late ? "text-destructive" : dueSoon ? "text-warning" : "text-muted-foreground")}>
              <HugeiconsIcon icon={Clock01Icon} className="size-4" aria-hidden />
              {late ? "Late — send it now" : `Send by ${sendBy(due, now)}`}
            </span>
          ) : null}
        </div>
        <p className="truncate text-[15px]">
          {first ? `${first.qty} × ${first.title}` : `${o.itemCount} item${o.itemCount === 1 ? "" : "s"}`}
          {more > 0 ? <span className="text-muted-foreground"> and {more} more</span> : null}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {o.placedAt ? <span>{timeAgo(o.placedAt, new Date(now))}</span> : null}
          {area ? (
            <span className="inline-flex items-center gap-1">
              <HugeiconsIcon icon={Location01Icon} className="size-4" aria-hidden />
              {area}
            </span>
          ) : null}
          {o.paymentMethod ? <span>{PAY[o.paymentMethod] ?? o.paymentMethod}</span> : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-bold tabular">{formatMinor(o.subtotalPesewas)}</p>
        <HugeiconsIcon icon={ArrowRight01Icon} className="ml-auto mt-2 size-5 text-muted-foreground" aria-hidden />
      </div>
    </Link>
  )
}
