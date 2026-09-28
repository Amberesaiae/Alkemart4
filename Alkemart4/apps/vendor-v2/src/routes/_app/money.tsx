import { useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Download04Icon,
  MoneyReceiveSquareIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { orderReference } from "@alkemart/shared/order-ref"
import { Button } from "@workspace/console-ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/console-ui/components/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/console-ui/components/collapsible"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@workspace/console-ui/components/toggle-group"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { StatCard } from "@workspace/console-ui/components/console/stat-card"
import { ToneBadge } from "@workspace/console-ui/components/console/status-badge"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { formatMinor } from "@workspace/console-ui/lib/money"
import type { Tone } from "@workspace/console-ui/lib/status"
import { cn } from "@workspace/console-ui/lib/utils"
import type { Payout, Statement, StatementLine } from "@/lib/api"
import { useStatement } from "@/lib/queries"
import { PayoutCard } from "@/components/shop/sections"

export const Route = createFileRoute("/_app/money")({
  component: MoneyPage,
})

const LINE_STATE: Record<StatementLine["state"], { label: string; tone: Tone }> = {
  pending: { label: "Next payout", tone: "info" },
  sending: { label: "On its way", tone: "brand" },
  paid: { label: "Paid", tone: "success" },
  held: { label: "On hold", tone: "warning" },
  cash: { label: "Cash collected", tone: "neutral" },
  refunded: { label: "Refunded to buyer", tone: "neutral" },
}

const PAYOUT_TONE: Record<Payout["status"], Tone> = {
  pending: "info",
  processing: "brand",
  paid: "success",
  failed: "danger",
  reversed: "danger",
}

const STEP_TEXT: Record<string, string> = {
  created: "Payout prepared",
  sent: "Sent to Paystack",
  paid: "Arrived on your MoMo",
  failed: "Didn't go through",
  reversed: "Returned by the network",
}


const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"

function MoneyPage() {
  const q = useStatement()
  if (q.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }
  if (q.isError) return <ErrorState title="Your money didn't load" error={q.error} onRetry={() => void q.refetch()} />
  const s = q.data
  const t = s.totals
  const hasCash = BigInt(t.cashCollectedPesewas) > 0n
  return (
    <div className="space-y-5">
      <PageHeader title="Money" description="What's coming to you, what's on its way, and every payout — with proof." />

      {s.holds.length ? <Holds holds={s.holds} lines={s.lines} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Next payout" value={formatMinor(t.pendingNetPesewas, s.currency)} icon={Wallet01Icon} hint={s.commissionBps > 0 ? "Delivered orders, after commission" : "Delivered orders"} />
        <StatCard label="On its way" value={formatMinor(t.sendingNetPesewas, s.currency)} icon={Clock01Icon} hint="Sent — waiting for Paystack" />
        <StatCard label="Paid to you" value={formatMinor(t.paidNetPesewas, s.currency)} icon={CheckmarkCircle02Icon} hint="Arrived on your MoMo" />
        <StatCard label="On hold" value={formatMinor(t.heldNetPesewas, s.currency)} icon={Alert02Icon} hint={s.holds.length ? "See the reason above" : "Nothing held"} />
      </div>

      {hasCash ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pay-on-delivery cash</CardTitle>
            <CardDescription>Your rider collected this cash, so it's already yours — it never goes through payouts.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted p-3">
              <p className="text-sm text-muted-foreground">Cash you collected</p>
              <p className="text-xl font-extrabold tabular">{formatMinor(t.cashCollectedPesewas, s.currency)}</p>
            </div>
            {Number(t.commissionOwedPesewas) > 0 ? (
              <div className="rounded-xl bg-warning-soft p-3">
                <p className="text-sm">Commission owed to alkemart ({s.commissionBps / 100}%)</p>
                <p className="text-xl font-extrabold tabular">{formatMinor(t.commissionOwedPesewas, s.currency)}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {Number(t.refundsToRecoverPesewas ?? 0) > 0 ? (
        <p role="status" className="rounded-2xl bg-warning-soft p-4 text-[15px]">
          <strong className="tabular">{formatMinor(t.refundsToRecoverPesewas!, s.currency)}</strong> in refunds on orders you'd already been paid for comes off your
          next payout. You'll see it on that payout.
        </p>
      ) : null}
      <PayoutCard account={s.payoutAccount} />
      <Payouts payouts={s.payouts} currency={s.currency} />
      <StatementCard s={s} />
      <HowItWorks bps={s.commissionBps} />
    </div>
  )
}

function Holds({ holds, lines }: { holds: Statement["holds"]; lines: StatementLine[] }) {
  const refOf = (orderId: string) => {
    const l = lines.find((x) => x.orderId === orderId)
    return l ? `Order ${orderReference(l.orderGroupId)}` : "One order"
  }
  return (
    <div role="status" className="space-y-2 rounded-2xl border-2 border-warning bg-warning-soft p-4">
      <p className="flex items-center gap-2 font-bold">
        <HugeiconsIcon icon={Alert02Icon} className="size-5 text-warning" aria-hidden /> Some money is on hold
      </p>
      <ul className="space-y-1 text-[15px]">
        {holds.map((h) => (
          <li key={h.id}>
            <strong>{h.orderId ? refOf(h.orderId) : "All your payouts"}</strong> — {h.reason} <span className="text-sm text-muted-foreground">(since {when(h.createdAt)})</span>
          </li>
        ))}
      </ul>
      <p className="text-sm">Held money joins your next payout as soon as the hold is released.</p>
    </div>
  )
}

// ─── Payouts with their timeline ────────────────────────────────────────

function Payouts({ payouts, currency }: { payouts: Payout[]; currency: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payouts</CardTitle>
        <CardDescription>Each payout with every step. Quote the reference if you ever contact support.</CardDescription>
      </CardHeader>
      <CardContent>
        {payouts.length === 0 ? (
          <EmptyState icon={MoneyReceiveSquareIcon} title="No payouts yet" description="Your first payout comes after your first delivered, paid-online order." />
        ) : (
          <ul className="space-y-3">
            {payouts.map((p) => (
              <li key={p.id}>
                <Collapsible className="rounded-2xl border">
                  <CollapsibleTrigger className="group flex w-full items-center gap-3 p-4 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-extrabold tabular">{formatMinor(p.netPesewas, currency)}</span>
                        <ToneBadge tone={PAYOUT_TONE[p.status]}>{p.statusText}</ToneBadge>
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {when(p.createdAt)} · {p.orderCount || "—"} order{p.orderCount === 1 ? "" : "s"}
                      </span>
                    </span>
                    <HugeiconsIcon icon={ArrowDown01Icon} className="size-5 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 border-t px-4 pb-4 pt-3">
                    {p.failureReason ? <p className="rounded-xl bg-danger-soft p-3 text-sm text-destructive">Reason: {p.failureReason}</p> : null}
                    {Number(p.recoveredPesewas ?? 0) > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Includes −{formatMinor(p.recoveredPesewas!, currency)} for refunds on orders you'd already been paid for.
                      </p>
                    ) : null}
                    <dl className={cn("grid gap-2 text-sm", Number(p.commissionPesewas) > 0 ? "grid-cols-3" : "grid-cols-2")}>
                      <div>
                        <dt className="text-muted-foreground">Sales</dt>
                        <dd className="font-semibold tabular">{formatMinor(p.grossPesewas, currency)}</dd>
                      </div>
                      {Number(p.commissionPesewas) > 0 ? (
                        <div>
                          <dt className="text-muted-foreground">Commission</dt>
                          <dd className="font-semibold tabular">−{formatMinor(p.commissionPesewas, currency)}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="text-muted-foreground">You get</dt>
                        <dd className="font-semibold tabular">{formatMinor(p.netPesewas, currency)}</dd>
                      </div>
                    </dl>
                    <ol className="space-y-2 border-l-2 pl-4">
                      {p.steps.map((st, i) => (
                        <li key={i} className="relative text-sm">
                          <span aria-hidden className={cn("absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full", st.status === "failed" || st.status === "reversed" ? "bg-destructive" : st.status === "paid" ? "bg-success" : "bg-foreground")} />
                          <span className="font-semibold">{STEP_TEXT[st.status] ?? st.status}</span>
                          <span className="text-muted-foreground"> · {st.by} · {new Date(st.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                          {st.detail ? <span className="block text-destructive">{st.detail}</span> : null}
                        </li>
                      ))}
                    </ol>
                    {p.reference ? (
                      <p className="text-xs text-muted-foreground">
                        Reference <span className="font-mono select-all">{p.reference}</span>
                      </p>
                    ) : null}
                  </CollapsibleContent>
                </Collapsible>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Statement ──────────────────────────────────────────────────────────

type Filter = "all" | StatementLine["state"]

function toCsv(s: Statement) {
  const head = ["Order", "Date", "Payment", "Status", "Sales", "Commission", "You get", "Cash collected", "Paid on"]
  const minor = (v: string | null) => (v == null ? "" : (Number(v) / 100).toFixed(2))
  const rows = s.lines.map((l) => [
    orderReference(l.orderGroupId),
    l.orderedAt?.slice(0, 10) ?? "",
    l.paymentMethod ?? "",
    LINE_STATE[l.state].label,
    minor(l.subtotalPesewas),
    minor(l.commissionPesewas),
    minor(l.netPesewas),
    minor(l.cashCollectedPesewas),
    l.paidAt?.slice(0, 10) ?? "",
  ])
  return [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
}

function StatementCard({ s }: { s: Statement }) {
  const [filter, setFilter] = useState<Filter>("all")
  const rows = useMemo(() => [...s.lines].filter((l) => filter === "all" || l.state === filter).sort((a, b) => (b.orderedAt ?? "").localeCompare(a.orderedAt ?? "")), [s.lines, filter])
  const counts = new Map<Filter, number>([["all", s.lines.length]])
  for (const l of s.lines) counts.set(l.state, (counts.get(l.state) ?? 0) + 1)
  const download = () => {
    const blob = new Blob([toCsv(s)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `alkemart-statement-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const filters: Filter[] = ["all", "pending", "sending", "paid", "held", "cash", "refunded"]
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Statement</CardTitle>
          <CardDescription>Every delivered order and what it earned you.</CardDescription>
        </div>
        <Button variant="outline" size="lg" onClick={download} disabled={!s.lines.length}>
          <HugeiconsIcon icon={Download04Icon} data-icon="inline-start" /> Download CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToggleGroup type="single" variant="outline" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} className="flex-wrap justify-start" aria-label="Filter statement">
          {filters
            .filter((f) => f === "all" || counts.get(f))
            .map((f) => (
              <ToggleGroupItem key={f} value={f} className="min-h-10 px-3.5">
                {f === "all" ? "All" : LINE_STATE[f].label} <span className="tabular opacity-70">{counts.get(f) ?? 0}</span>
              </ToggleGroupItem>
            ))}
        </ToggleGroup>
        {rows.length === 0 ? (
          <EmptyState illustration="empty-orders" illustrationSize="compact" icon={MoneyReceiveSquareIcon} title="No delivered orders yet" description="Orders appear here once they're delivered." action={<Button asChild variant="outline"><Link to="/orders">See orders</Link></Button>} />
        ) : (
          <ul className="divide-y">
            {rows.map((l) => (
              <li key={l.orderId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <Link to="/orders/$id" params={{ id: l.orderId }} className="min-w-0 flex-1 font-semibold hover:underline">
                  Order {orderReference(l.orderGroupId)}
                  <span className="block text-sm font-normal text-muted-foreground">
                    {when(l.orderedAt)} · {l.paymentMethod === "cod" ? "Pay on delivery" : l.paymentMethod === "card" ? "Card" : "MoMo"}
                  </span>
                </Link>
                <ToneBadge tone={LINE_STATE[l.state].tone}>{LINE_STATE[l.state].label}</ToneBadge>
                <span className="w-full text-right tabular sm:w-40">
                  <span className="block font-bold">{l.state === "cash" ? formatMinor(l.cashCollectedPesewas, s.currency) : formatMinor(l.netPesewas, s.currency)}</span>
                  {Number(l.commissionPesewas) > 0 ? (
                    <span className="block text-xs text-muted-foreground">
                      {l.state === "cash" ? `owe ${formatMinor(l.commissionPesewas, s.currency)}` : `of ${formatMinor(l.subtotalPesewas, s.currency)} · −${formatMinor(l.commissionPesewas, s.currency)}`}
                    </span>
                  ) : null}
                  {l.holdReason ? <span className="block text-xs text-warning">{l.holdReason}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function HowItWorks({ bps }: { bps: number }) {
  return (
    <Collapsible className="rounded-2xl border bg-card">
      <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left font-bold">
        How money works on alkemart
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 px-4 pb-4 text-[15px]">
        <p>
          <strong>Paid online (MoMo or card):</strong> the buyer pays alkemart through Paystack and the money is held until they have the order. When the buyer
          gives you their handover code (or taps "I got it"), {bps > 0 ? <>your share — the sale minus {bps / 100}% commission —</> : "the full sale"} joins your next payout to your MoMo. If you
          mark it delivered without the code, it joins when the buyer's report window ends, unless they report a problem.
        </p>
        <p>
          <strong>Pay on delivery:</strong> your rider collects the cash, so it's yours straight away.{bps > 0 ? ` You owe the ${bps / 100}% commission on it.` : ""}
        </p>
        <p>
          <strong>On its way:</strong> Paystack is sending it. If a transfer doesn't go through, those orders go back into your next payout automatically — you never
          lose them.
        </p>
        <p>
          <strong>On hold:</strong> we pause money only with a written reason, shown here, and release it once it's sorted.
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}
