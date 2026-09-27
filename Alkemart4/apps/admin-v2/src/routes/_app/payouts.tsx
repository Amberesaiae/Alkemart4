import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, ArrowRight01Icon, CheckmarkCircle02Icon, MoneySend02Icon, RefreshIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons"
import { orderReference } from "@alkemart/shared/order-ref"
import { Button } from "@workspace/console-ui/components/button"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Textarea } from "@workspace/console-ui/components/textarea"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/console-ui/components/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/console-ui/components/alert-dialog"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ToneBadge } from "@workspace/console-ui/components/console/status-badge"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { formatMinor, timeAgo } from "@workspace/console-ui/lib/money"
import type { Tone } from "@workspace/console-ui/lib/status"
import { cn } from "@workspace/console-ui/lib/utils"
import {
  checkPayout,
  createHold,
  getPayout,
  listHolds,
  listPayable,
  listPaystackEvents,
  listPayouts,
  payEveryone,
  payNow,
  refundPayment,
  releaseHold,
  retryPayout,
  type AdminPayout,
  type PayableSeller,
  type PayoutStatus,
  type PaystackEvent,
} from "@/lib/payouts"

type Tab = "ready" | "history" | "paystack"
const TABS: { id: Tab; label: string }[] = [
  { id: "ready", label: "Ready to pay" },
  { id: "history", label: "History" },
  { id: "paystack", label: "Paystack log" },
]

export const Route = createFileRoute("/_app/payouts")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: TABS.some((t) => t.id === s.tab) ? (s.tab as Tab) : undefined }),
  component: PayoutsPage,
})

const STATUS: Record<PayoutStatus, { label: string; tone: Tone }> = {
  pending: { label: "Not confirmed", tone: "warning" },
  processing: { label: "Sending", tone: "brand" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  reversed: { label: "Reversed", tone: "danger" },
}

const ALERT_TEXT: Record<string, string> = {
  paid_after_close: "Buyer paid after the checkout closed — refund them",
  amount_mismatch: "Paystack's amount didn't match our payout",
  unknown_reference: "Successful charge we have no checkout for",
  dispute: "Buyer opened a dispute",
  refund_failed: "A refund failed",
}

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong.")

function PayoutsPage() {
  const { tab = "ready" } = Route.useSearch()
  const events = useQuery({ queryKey: ["paystack-events"], queryFn: listPaystackEvents, staleTime: 30_000 })
  const alerts = (events.data ?? []).filter((e) => e.alert).length
  return (
    <div className="space-y-6">
      <PageHeader title="Payouts" description="Pay sellers through Paystack. Every payout is confirmed by Paystack before it counts as paid." />
      <nav aria-label="Payout views" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <Link
              key={t.id}
              to="/payouts"
              search={{ tab: t.id }}
              replace
              aria-current={active ? "page" : undefined}
              className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}
            >
              {t.label}
              {t.id === "paystack" && alerts ? (
                <span className="rounded-full bg-destructive px-1.5 text-xs text-white tabular">
                  {alerts}
                  <span className="sr-only"> alerts</span>
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
      {tab === "ready" ? <Ready /> : tab === "history" ? <History /> : <PaystackLog q={events} />}
    </div>
  )
}

// ─── Ready to pay ───────────────────────────────────────────────────────

function Ready() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["payable"], queryFn: listPayable, staleTime: 20_000 })
  const [confirm, setConfirm] = useState<PayableSeller | null>(null)
  const [holdsFor, setHoldsFor] = useState<PayableSeller | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const payAll = useMutation({
    mutationFn: payEveryone,
    onSuccess: (results) => {
      const sent = results.filter((r) => r.outcome === "paid" || r.outcome === "sent")
      const problems = results.filter((r) => !(r.outcome === "paid" || r.outcome === "sent"))
      if (sent.length) toast.success(`Sent ${sent.length} payout${sent.length === 1 ? "" : "s"}.`)
      else if (!problems.length) toast.success("Nobody was ready to pay.")
      for (const r of problems) toast.warning(`${r.sellerName}: ${r.message}`)
      void qc.invalidateQueries({ queryKey: ["payable"] })
      void qc.invalidateQueries({ queryKey: ["payouts"] })
    },
    onError: (e) => toast.error(errText(e)),
    onSettled: () => setConfirmAll(false),
  })
  const pay = useMutation({
    mutationFn: (s: PayableSeller) => payNow(s.sellerId),
    onSuccess: (r) => {
      const msg = r.message ?? "Done."
      if (r.outcome === "failed" || r.outcome === "otp") toast.error(msg)
      else if (r.outcome === "unknown" || r.replayed) toast.warning(msg)
      else toast.success(msg)
      void qc.invalidateQueries({ queryKey: ["payable"] })
      void qc.invalidateQueries({ queryKey: ["payouts"] })
    },
    onError: (e) => toast.error(errText(e)),
    onSettled: () => setConfirm(null),
  })
  if (q.isPending) return <Skeleton className="h-48 rounded-2xl" />
  if (q.isError) return <ErrorState title="Couldn't load who's payable" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
  const rows = q.data
  if (!rows.length) return <EmptyState icon={CheckmarkCircle02Icon} title="Nobody is waiting for a payout" description="Sellers appear here once a paid-online order is delivered." className="rounded-2xl border bg-card" />
  const ready = rows.filter((s) => s.orderCount > 0 && !s.blocker)
  const readyTotal = ready.reduce((sum, s) => sum + BigInt(s.netPesewas), 0n)
  return (
    <>
      {ready.length ? (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {ready.length} seller{ready.length === 1 ? "" : "s"} ready · {formatMinor(readyTotal)}
            </span>{" "}
            — money released after delivery. Sellers on hold or already being paid are left out.
          </p>
          <Button variant="brand" onClick={() => setConfirmAll(true)}>
            <HugeiconsIcon icon={MoneySend02Icon} data-icon="inline-start" /> Pay everyone ready
          </Button>
        </div>
      ) : null}
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {rows.map((s) => (
          <li key={s.sellerId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold">{s.sellerName}</p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {s.orderCount > 0 ? (
                  <span>
                    {s.orderCount} order{s.orderCount === 1 ? "" : "s"} · sales {formatMinor(s.grossPesewas)} · commission {formatMinor(s.commissionPesewas)}
                  </span>
                ) : (
                  <span>No new delivered orders</span>
                )}
                {s.payoutAccount ? (
                  <span className="inline-flex items-center gap-1">
                    <HugeiconsIcon icon={SmartPhone01Icon} className="size-4" aria-hidden /> {s.payoutAccount.provider?.toUpperCase()} •••• {s.payoutAccount.phoneLast4}
                  </span>
                ) : null}
                {s.heldOrders ? <ToneBadge tone="warning">{s.heldOrders} held</ToneBadge> : null}
              </p>
              {s.blocker ? <p className="text-sm font-medium text-warning">{s.blocker}</p> : null}
            </div>
            {s.orderCount > 0 ? <p className="text-xl font-extrabold tabular">{formatMinor(s.netPesewas)}</p> : null}
            <div className="flex gap-2">
              {s.inFlightPayoutId ? (
                <Button asChild variant="outline">
                  <Link to="/payouts" search={{ tab: "history" }}>
                    See payout on its way
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setHoldsFor(s)}>
                Holds
              </Button>
              {s.orderCount > 0 ? (
                <Button variant="brand" disabled={!!s.blocker} onClick={() => setConfirm(s)}>
                  <HugeiconsIcon icon={MoneySend02Icon} data-icon="inline-start" /> Pay
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && !pay.isPending && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send {confirm ? formatMinor(confirm.netPesewas) : ""} to {confirm?.sellerName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Paystack sends it to {confirm?.payoutAccount ? `${confirm.payoutAccount.provider?.toUpperCase()} •••• ${confirm.payoutAccount.phoneLast4}` : "their MoMo"} for {confirm?.orderCount} delivered order
              {confirm?.orderCount === 1 ? "" : "s"}. It counts as paid only when Paystack confirms. Held orders are left out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pay.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pay.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (confirm) pay.mutate(confirm)
              }}
            >
              {pay.isPending ? <Spinner /> : null} Send payout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmAll} onOpenChange={(o) => !o && !payAll.isPending && setConfirmAll(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Pay {ready.length} seller{ready.length === 1 ? "" : "s"} {formatMinor(readyTotal)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Paystack sends each seller's released money to their MoMo. Each counts as paid only when Paystack confirms. Held orders and sellers on hold are left out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={payAll.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={payAll.isPending}
              onClick={(e) => {
                e.preventDefault()
                payAll.mutate()
              }}
            >
              {payAll.isPending ? <Spinner /> : null} Send payouts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Sheet open={holdsFor !== null} onOpenChange={(o) => !o && setHoldsFor(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">{holdsFor ? <HoldsPanel seller={holdsFor} /> : null}</SheetContent>
      </Sheet>
    </>
  )
}

function HoldsPanel({ seller }: { seller: PayableSeller }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["holds", seller.sellerId], queryFn: () => listHolds(seller.sellerId) })
  const [reason, setReason] = useState("")
  const [orderId, setOrderId] = useState("")
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["holds", seller.sellerId] })
    void qc.invalidateQueries({ queryKey: ["payable"] })
  }
  const add = useMutation({
    mutationFn: () => createHold({ sellerId: seller.sellerId, orderId: orderId.trim() || null, reason: reason.trim() }),
    onSuccess: () => {
      setReason("")
      setOrderId("")
      refresh()
      toast.success("Hold placed. The seller sees the reason.")
    },
    onError: (e) => toast.error(errText(e)),
  })
  const release = useMutation({
    mutationFn: releaseHold,
    onSuccess: () => {
      refresh()
      toast.success("Released — it joins the next payout.")
    },
    onError: (e) => toast.error(errText(e)),
  })
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-left">Holds · {seller.sellerName}</SheetTitle>
        <SheetDescription className="text-left">A hold pauses money with a written reason the seller can read. Every hold and release is logged with your name.</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-8">
        {q.isPending ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : (
          <ul className="space-y-2">
            {(q.data ?? []).length === 0 ? <li className="text-sm text-muted-foreground">No holds.</li> : null}
            {(q.data ?? []).map((h) => (
              <li key={h.id} className="space-y-1 rounded-xl border p-3 text-sm">
                <p className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{h.orderId ? `Order ${h.orderId.slice(0, 8)}` : "All payouts"}</span>
                  <ToneBadge tone={h.status === "held" ? "warning" : "neutral"}>{h.status === "held" ? "Held" : "Released"}</ToneBadge>
                </p>
                <p>{h.reason}</p>
                <p className="text-muted-foreground">
                  {timeAgo(h.createdAt)}
                  {h.releasedAt ? ` · released ${timeAgo(h.releasedAt)}` : ""}
                </p>
                {h.status === "held" ? (
                  <Button size="sm" variant="outline" disabled={release.isPending} onClick={() => release.mutate(h.id)}>
                    Release
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <section aria-labelledby="new-hold" className="space-y-3 rounded-2xl border p-4">
          <h3 id="new-hold" className="font-semibold">
            Place a hold
          </h3>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">What to hold</legend>
            <label className="flex min-h-10 items-center gap-2.5 text-sm">
              <input type="radio" name="hold-target" className="size-4 accent-foreground" checked={orderId === ""} onChange={() => setOrderId("")} />
              All of this seller's payouts
            </label>
            {seller.orders.map((o) => (
              <label key={o.orderId} className="flex min-h-10 items-center gap-2.5 text-sm">
                <input type="radio" name="hold-target" className="size-4 accent-foreground" checked={orderId === o.orderId} onChange={() => setOrderId(o.orderId)} />
                Order {orderReference(o.orderGroupId)} · {formatMinor(o.subtotalPesewas)}
              </label>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="hold-reason">Reason (the seller sees this)</Label>
            <Textarea id="hold-reason" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Buyer reported the item wasn't delivered — checking with the rider." />
          </div>
          <Button disabled={!reason.trim() || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? <Spinner /> : null} Place hold
          </Button>
        </section>
      </div>
    </>
  )
}

// ─── History ────────────────────────────────────────────────────────────

function History() {
  const q = useQuery({ queryKey: ["payouts"], queryFn: listPayouts, staleTime: 20_000 })
  const [open, setOpen] = useState<AdminPayout | null>(null)
  if (q.isPending) return <Skeleton className="h-48 rounded-2xl" />
  if (q.isError) return <ErrorState title="Couldn't load payouts" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
  if (!q.data.length) return <EmptyState icon={MoneySend02Icon} title="No payouts yet" className="rounded-2xl border bg-card" />
  return (
    <>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {q.data.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setOpen(p)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/60">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{p.sellerName ?? p.sellerId}</span>
                <span className="block text-sm text-muted-foreground">
                  {p.createdAt ? timeAgo(p.createdAt) : "—"}
                  {p.failureReason ? ` · ${p.failureReason}` : ""}
                </span>
              </span>
              <ToneBadge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</ToneBadge>
              <span className="w-28 text-right font-bold tabular">{formatMinor(p.netPesewas)}</span>
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">{open ? <PayoutPanel id={open.id} /> : null}</SheetContent>
      </Sheet>
    </>
  )
}

const ACTOR = (a: string) => (a === "paystack" ? "Paystack" : a === "system" ? "System" : a.startsWith("admin:") ? "Admin" : a)

function PayoutPanel({ id }: { id: string }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["payout", id], queryFn: () => getPayout(id) })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["payout", id] })
    void qc.invalidateQueries({ queryKey: ["payouts"] })
    void qc.invalidateQueries({ queryKey: ["payable"] })
  }
  const check = useMutation({
    mutationFn: () => checkPayout(id),
    onSuccess: (r) => {
      refresh()
      toast.message(r.message ?? `Paystack says: ${r.paystackStatus}`)
    },
    onError: (e) => toast.error(errText(e)),
  })
  const retry = useMutation({
    mutationFn: () => retryPayout(id),
    onSuccess: (r) => {
      refresh()
      toast.message(r.message ?? "Retried.")
    },
    onError: (e) => toast.error(errText(e)),
  })
  if (q.isPending) return <Skeleton className="m-4 h-64 rounded-xl" />
  if (q.isError) return <ErrorState title="Couldn't load this payout" error={q.error} onRetry={() => void q.refetch()} />
  const { payout: p, lines, events } = q.data
  const open = p.status === "pending" || p.status === "processing"
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 text-left">
          {formatMinor(p.netPesewas)} <ToneBadge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</ToneBadge>
        </SheetTitle>
        <SheetDescription className="text-left">{p.sellerName}</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-8">
        {p.failureReason ? <p className="rounded-xl bg-danger-soft p-3 text-sm text-destructive">{p.failureReason}</p> : null}
        {p.status === "pending" ? (
          <p className="rounded-xl bg-warning-soft p-3 text-sm">Paystack hasn't confirmed receiving this. Check status first; Retry reuses the same reference, so money can't be sent twice.</p>
        ) : null}
        {open ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={check.isPending} onClick={() => check.mutate()}>
              {check.isPending ? <Spinner /> : <HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />} Check status with Paystack
            </Button>
            {p.status === "pending" ? (
              <Button disabled={retry.isPending} onClick={() => retry.mutate()}>
                {retry.isPending ? <Spinner /> : null} Retry (same reference)
              </Button>
            ) : null}
          </div>
        ) : null}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Sales</dt>
            <dd className="font-semibold tabular">{formatMinor(p.grossPesewas)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Commission ({p.commissionBps / 100}%)</dt>
            <dd className="font-semibold tabular">{formatMinor(p.commissionPesewas)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Paystack reference</dt>
            <dd className="font-mono text-xs break-all select-all">{p.paystackReference ?? "—"}</dd>
          </div>
          {p.paystackTransferCode ? (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Transfer code</dt>
              <dd className="font-mono text-xs select-all">{p.paystackTransferCode}</dd>
            </div>
          ) : null}
        </dl>
        <section aria-labelledby="timeline" className="space-y-2">
          <h3 id="timeline" className="font-semibold">
            Timeline
          </h3>
          <ol className="space-y-2 border-l-2 pl-4 text-sm">
            {events.map((e) => (
              <li key={e.id}>
                <span className="font-semibold capitalize">{e.status}</span>
                <span className="text-muted-foreground"> · {ACTOR(e.actor)} · {new Date(e.createdAt).toLocaleString()}</span>
                {e.detail ? <span className="block text-muted-foreground">{e.detail}</span> : null}
              </li>
            ))}
          </ol>
        </section>
        {lines.length ? (
          <section aria-labelledby="lines" className="space-y-2">
            <h3 id="lines" className="font-semibold">
              Orders ({lines.length})
            </h3>
            <ul className="divide-y rounded-xl border text-sm">
              {lines.map((l) => (
                <li key={l.orderId} className="flex justify-between gap-2 p-2.5">
                  <span className="font-mono text-xs">{l.orderId.slice(0, 8)}</span>
                  <span className="tabular">
                    {formatMinor(l.grossPesewas)} → <strong>{formatMinor(l.netPesewas)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : p.status === "failed" || p.status === "reversed" ? (
          <p className="text-sm text-muted-foreground">Its orders went back to the seller's next payout.</p>
        ) : null}
      </div>
    </>
  )
}

// ─── Paystack log ───────────────────────────────────────────────────────

function PaystackLog({ q }: { q: ReturnType<typeof useQuery<PaystackEvent[]>> }) {
  const qc = useQueryClient()
  const [refundRef, setRefundRef] = useState<string | null>(null)
  const refund = useMutation({
    mutationFn: (ref: string) => refundPayment(ref),
    onSuccess: (r) => {
      toast.success(`Refund requested — Paystack status: ${r.refund.status}`)
      void qc.invalidateQueries({ queryKey: ["paystack-events"] })
    },
    onError: (e) => toast.error(errText(e)),
    onSettled: () => setRefundRef(null),
  })
  if (q.isPending) return <Skeleton className="h-48 rounded-2xl" />
  if (q.isError) return <ErrorState title="Couldn't load the Paystack log" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
  const events = q.data ?? []
  const alerts = events.filter((e) => e.alert)
  const refunded = new Set(events.filter((e) => e.event === "refund.requested").map((e) => e.reference))
  return (
    <div className="space-y-4">
      {alerts.length ? (
        <section aria-labelledby="alerts-title" className="space-y-2 rounded-2xl border-2 border-destructive/40 bg-danger-soft p-4">
          <h2 id="alerts-title" className="flex items-center gap-2 font-bold">
            <HugeiconsIcon icon={Alert02Icon} className="size-5 text-destructive" aria-hidden /> Needs a person ({alerts.length})
          </h2>
          <ul className="space-y-2">
            {alerts.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-background p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{ALERT_TEXT[e.alert!] ?? e.alert}</span>
                  <span className="block text-muted-foreground">
                    {e.reference ?? "—"} · {e.amountMinor ? formatMinor(e.amountMinor, e.currency ?? undefined) : ""} · {timeAgo(e.receivedAt)}
                  </span>
                  {e.detail ? <span className="block text-muted-foreground">{e.detail}</span> : null}
                </span>
                {e.alert === "paid_after_close" && e.reference ? (
                  refunded.has(e.reference) ? (
                    <ToneBadge tone="success">Refund requested</ToneBadge>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => setRefundRef(e.reference)}>
                      Refund buyer
                    </Button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl bg-success-soft p-4 font-semibold text-success">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5" aria-hidden /> No Paystack alerts.
        </p>
      )}
      {events.length === 0 ? (
        <EmptyState icon={MoneySend02Icon} title="No Paystack events yet" description="Signed webhooks from Paystack appear here with what we did about each." className="rounded-2xl border bg-card" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Paystack webhook events</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th scope="col" className="p-3 font-medium">When</th>
                <th scope="col" className="p-3 font-medium">Event</th>
                <th scope="col" className="p-3 font-medium">Reference</th>
                <th scope="col" className="p-3 text-right font-medium">Amount</th>
                <th scope="col" className="p-3 font-medium">What we did</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="p-3 whitespace-nowrap">{timeAgo(e.receivedAt)}</td>
                  <td className="p-3 font-mono text-xs">{e.event}</td>
                  <td className="p-3 font-mono text-xs break-all">{e.reference ?? "—"}</td>
                  <td className="p-3 text-right tabular">{e.amountMinor ? formatMinor(e.amountMinor, e.currency ?? undefined) : "—"}</td>
                  <td className="p-3">
                    <ToneBadge tone={e.alert ? "danger" : e.outcome === "ignored" || e.outcome === "duplicate" ? "neutral" : "success"}>{e.alert ? "Alert" : e.outcome}</ToneBadge>
                    {e.detail ? <span className="block text-xs text-muted-foreground">{e.detail}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AlertDialog open={refundRef !== null} onOpenChange={(o) => !o && !refund.isPending && setRefundRef(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this buyer in full?</AlertDialogTitle>
            <AlertDialogDescription>
              Paystack returns the whole payment for reference {refundRef}. This checkout has no order, so nothing else changes. The refund is logged with your name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refund.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={refund.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (refundRef) refund.mutate(refundRef)
              }}
            >
              {refund.isPending ? <Spinner /> : null} Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
