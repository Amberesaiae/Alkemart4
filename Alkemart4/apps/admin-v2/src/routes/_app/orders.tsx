import { useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, PackageIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { orderReference } from "@alkemart/shared/order-ref"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Textarea } from "@workspace/console-ui/components/textarea"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/console-ui/components/sheet"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ToneBadge } from "@workspace/console-ui/components/console/status-badge"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { formatMinor, timeAgo } from "@workspace/console-ui/lib/money"
import type { Tone } from "@workspace/console-ui/lib/status"
import { cn } from "@workspace/console-ui/lib/utils"
import { listSellers } from "@/lib/api"
import { listOrders, type AdminOrderGroup, type AdminSellerOrder, type PaymentState, type PromiseState } from "@/lib/ops"
import { createHold } from "@/lib/payouts"

type View = "late" | "to-ship" | "on-the-way" | "delivered" | "cancelled" | "all"
const VIEWS: { id: View; label: string }[] = [
  { id: "late", label: "Late" },
  { id: "to-ship", label: "To ship" },
  { id: "on-the-way", label: "On the way" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
]

export const Route = createFileRoute("/_app/orders")({
  validateSearch: (s: Record<string, unknown>): { view?: View } => ({ view: VIEWS.some((v) => v.id === s.view) ? (s.view as View) : undefined }),
  component: OrdersPage,
})

const STATUS: Record<AdminSellerOrder["status"], { label: string; tone: Tone }> = {
  placed: { label: "To ship", tone: "info" },
  shipped: { label: "On the way", tone: "brand" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
}
const PAY: Record<PaymentState, { label: string; tone: Tone }> = {
  paid: { label: "Paid online", tone: "success" },
  collected: { label: "Cash collected", tone: "success" },
  collect_on_delivery: { label: "Cash on delivery — due", tone: "warning" },
  pending: { label: "Payment pending", tone: "warning" },
  failed: { label: "Payment failed", tone: "danger" },
}
const LATE: Partial<Record<PromiseState, string>> = { dispatch_late: "Not sent on time", delivery_late: "Delivery overdue" }

const isLate = (g: AdminOrderGroup) => g.orders.some((o) => o.promise.state === "dispatch_late" || o.promise.state === "delivery_late")
function inView(g: AdminOrderGroup, v: View) {
  if (v === "all") return true
  if (v === "late") return isLate(g)
  const want = { "to-ship": "placed", "on-the-way": "shipped", delivered: "delivered", cancelled: "cancelled" }[v]
  return g.orders.some((o) => o.status === want)
}

function OrdersPage() {
  const { view = "late" } = Route.useSearch()
  const q = useQuery({ queryKey: ["admin-orders"], queryFn: listOrders, staleTime: 20_000 })
  const sellers = useQuery({ queryKey: ["sellers"], queryFn: listSellers, staleTime: 300_000 })
  const [term, setTerm] = useState("")
  const [open, setOpen] = useState<AdminOrderGroup | null>(null)
  const sellerName = useMemo(() => new Map((sellers.data ?? []).map((s) => [s.id, s.name])), [sellers.data])
  const all = q.data ?? []
  const counts = new Map(VIEWS.map((v) => [v.id, all.filter((g) => inView(g, v.id)).length]))
  const needle = term.trim().toLowerCase().replace(/^#/, "")
  const rows = all
    .filter((g) => inView(g, view))
    .filter(
      (g) =>
        !needle ||
        orderReference(g.id).toLowerCase().includes(needle) ||
        g.buyerEmail?.toLowerCase().includes(needle) ||
        g.shippingAddress?.phone?.replace(/\D/g, "").includes(needle.replace(/\D/g, "") || "~"),
    )
  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Every order, each seller's part, the delivery promise and how it's paid." />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Order views" className="flex flex-wrap gap-2">
          {VIEWS.map((v) => {
            const active = view === v.id
            const n = counts.get(v.id) ?? 0
            return (
              <Link
                key={v.id}
                to="/orders"
                search={{ view: v.id }}
                replace
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold",
                  active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
                  v.id === "late" && n > 0 && !active && "border-destructive text-destructive",
                )}
              >
                {v.label} <span className="tabular opacity-70">{n}</span>
              </Link>
            )
          })}
        </nav>
        <div className="relative lg:w-72">
          <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search orders" placeholder="#REF, email or phone" className="pl-9" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      </div>

      {q.isPending ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Orders didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : rows.length === 0 ? (
        <EmptyState illustration={needle ? "no-results" : "empty-orders"} icon={PackageIcon} title={needle ? "No matching orders" : view === "late" ? "Nothing late — every promise is on track" : "No orders here"} description={needle ? "Try another reference, email or phone number." : undefined} className="rounded-2xl border bg-card" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {rows.map((g) => {
            const late = g.orders.map((o) => LATE[o.promise.state]).find(Boolean)
            const pay = PAY[g.orders[0]?.paymentState ?? "pending"]
            return (
              <li key={g.id}>
                <button type="button" onClick={() => setOpen(g)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/60">
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Order {orderReference(g.id)}</span>
                      {late ? <ToneBadge tone="danger">{late}</ToneBadge> : null}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {g.createdAt ? timeAgo(g.createdAt) : ""} · {g.orders.map((o) => sellerName.get(o.sellerId) ?? "Shop").join(", ")} · {g.buyerEmail ?? "guest"}
                    </span>
                  </span>
                  <span className="hidden flex-col items-end gap-1 sm:flex">
                    <ToneBadge tone={pay.tone}>{pay.label}</ToneBadge>
                    <span className="flex gap-1">
                      {g.orders.map((o) => (
                        <ToneBadge key={o.id} tone={STATUS[o.status].tone}>
                          {STATUS[o.status].label}
                        </ToneBadge>
                      ))}
                    </span>
                  </span>
                  <span className="w-24 text-right font-bold tabular">{formatMinor(g.totalPesewas, g.currency)}</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 text-muted-foreground" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {open ? <OrderPanel g={open} sellerName={(id) => sellerName.get(id) ?? "Shop"} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—")
const STEP: Record<string, string> = { placed: "Placed", shipped: "Sent", delivered: "Delivered", cancelled: "Cancelled" }

function OrderPanel({ g, sellerName }: { g: AdminOrderGroup; sellerName: (id: string) => string }) {
  const a = g.shippingAddress
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-left">Order {orderReference(g.id)}</SheetTitle>
        <SheetDescription className="text-left">
          {fmt(g.createdAt)} · {formatMinor(g.totalPesewas, g.currency)} · {g.paymentMethod === "cod" ? "Pay on delivery" : g.paymentMethod === "card" ? "Card" : "MoMo"}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-8">
        <section aria-labelledby="buyer" className="rounded-2xl border p-4 text-sm">
          <h3 id="buyer" className="mb-1 font-semibold">
            Buyer
          </h3>
          <p>{g.buyerEmail ?? "Guest"}</p>
          {a ? (
            <p className="text-muted-foreground">
              {a.first_name} {a.last_name} · {a.phone}
              <br />
              {[a.address_1, a.address_2, a.city, a.province, a.postal_code].filter(Boolean).join(", ")}
            </p>
          ) : null}
        </section>
        {g.orders.map((o) => (
          <SellerPart key={o.id} o={o} currency={g.currency} shop={sellerName(o.sellerId)} />
        ))}
      </div>
    </>
  )
}

function SellerPart({ o, currency, shop }: { o: AdminSellerOrder; currency: string; shop: string }) {
  const qc = useQueryClient()
  const [holding, setHolding] = useState(false)
  const [reason, setReason] = useState("")
  const hold = useMutation({
    mutationFn: () => createHold({ sellerId: o.sellerId, orderId: o.id, reason: reason.trim() }),
    onSuccess: () => {
      setHolding(false)
      setReason("")
      void qc.invalidateQueries({ queryKey: ["payable"] })
      void qc.invalidateQueries({ queryKey: ["admin-orders"] })
      toast.success("Payout for this order is on hold. The seller sees your reason.")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't place the hold."),
  })
  const late = LATE[o.promise.state]
  return (
    <section aria-label={`${shop} part`} className="space-y-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{shop}</h3>
        <span className="flex gap-1.5">
          <ToneBadge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</ToneBadge>
          <ToneBadge tone={PAY[o.paymentState].tone}>{PAY[o.paymentState].label}</ToneBadge>
        </span>
      </div>
      <ul className="space-y-1 text-sm">
        {o.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span>
              {i.qty} × {i.title}
            </span>
            <span className="tabular">{formatMinor(BigInt(i.unitPricePesewas) * BigInt(i.qty), currency)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 text-muted-foreground">
          <span>Delivery</span>
          <span className="tabular">{formatMinor(o.deliveryFeePesewas, currency)}</span>
        </li>
      </ul>
      <div className={cn("rounded-xl p-3 text-sm", late ? "bg-danger-soft text-destructive" : "bg-muted")}>
        <p className="font-semibold">{late ?? (o.promise.state === "done" ? "Promise closed" : "On track")}</p>
        <p>Send by {fmt(o.promise.dispatchBy)}</p>
        <p>
          Deliver {o.promise.deliverEarliest ? `${fmt(o.promise.deliverEarliest)} – ` : "by "}
          {fmt(o.promise.deliverLatest)}
        </p>
      </div>
      <ol className="space-y-1 border-l-2 pl-4 text-sm">
        {o.timeline.map((t, i) => (
          <li key={i}>
            <span className="font-semibold">{STEP[t.status] ?? t.status}</span>
            <span className="text-muted-foreground"> · {t.by} · {fmt(t.at)}</span>
          </li>
        ))}
      </ol>
      {o.payoutHold ? (
        <p className="rounded-xl bg-warning-soft p-3 text-sm">
          <span className="font-semibold">Payout on hold</span> — {o.payoutHold.reason}{" "}
          <Link to="/payouts" className="font-semibold underline underline-offset-4">
            Manage in Payouts
          </Link>
        </p>
      ) : o.paymentState === "paid" && o.status !== "cancelled" ? (
        holding ? (
          <div className="space-y-2">
            <Label htmlFor={`hold-${o.id}`}>Why hold this order's payout? (the seller sees this)</Label>
            <Textarea id={`hold-${o.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" disabled={!reason.trim() || hold.isPending} onClick={() => hold.mutate()}>
                {hold.isPending ? <Spinner /> : null} Place hold
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setHolding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setHolding(true)}>
            Hold this order's payout
          </Button>
        )
      ) : null}
    </section>
  )
}
