import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Tabs, TabsList, TabsTrigger } from "@workspace/console-ui/components/tabs"
import { Textarea } from "@workspace/console-ui/components/textarea"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ReturnCaseCard, returnCaseText } from "@workspace/console-ui/components/console/return-case"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { formatMinor, timeAgo } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { decideReturn, getReturn, listReturns, retryRefund, type AdminReturnCase, type AdminReturnDetail, type ReturnView } from "@/lib/returns"
import { qk } from "@/lib/queries"

const VIEWS: { id: ReturnView; label: string; empty: string }[] = [
  { id: "decide", label: "Needs a decision", empty: "Nothing to decide — buyers and sellers are settling their own." },
  { id: "open", label: "Open", empty: "No open returns." },
  { id: "refunds", label: "Refunds to check", empty: "No refunds need a hand." },
  { id: "closed", label: "Closed", empty: "No closed returns yet." },
]

export const Route = createFileRoute("/_app/returns")({
  validateSearch: (s: Record<string, unknown>): { view?: ReturnView } => ({ view: VIEWS.some((v) => v.id === s.view) ? (s.view as ReturnView) : undefined }),
  component: ReturnsPage,
})

function ReturnsPage() {
  const { view = "decide" } = Route.useSearch()
  const q = useQuery({ queryKey: qk.returns(view), queryFn: () => listReturns(view), staleTime: 20_000 })
  const [open, setOpen] = useState<string | null>(null)
  const meta = VIEWS.find((v) => v.id === view)!
  return (
    <div className="space-y-5">
      <PageHeader
        title="Returns & disputes"
        description="Buyers and sellers settle returns themselves. You only decide what they couldn't — after the seller's reply time runs out, or when the buyer asks."
      />
      <Tabs value={view}>
        <TabsList className="scroll-quiet h-auto w-full justify-start overflow-x-auto sm:w-auto">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.id} value={v.id} asChild className="min-h-11 shrink-0 px-3">
              <Link to="/returns" search={{ view: v.id }} replace>
                {v.label}
                {q.data ? (
                  <span className={cn("ml-1.5 rounded-full px-1.5 text-xs font-bold tabular", (v.id === "decide" || v.id === "refunds") && q.data.counts[v.id] > 0 ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground")}>
                    {q.data.counts[v.id]}
                  </span>
                ) : null}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {q.isPending ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Returns didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : q.data.items.length === 0 ? (
        <EmptyState icon={CheckmarkCircle02Icon} title={meta.empty} className="rounded-2xl border bg-card" />
      ) : (
        <ul className="space-y-3" aria-label={meta.label}>
          {q.data.items.map((r) => (
            <li key={r.id}>
              <CaseRow r={r} expanded={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CaseRow({ r, expanded, onToggle }: { r: AdminReturnCase; expanded: boolean; onToggle: () => void }) {
  const t = returnCaseText(r, "admin")
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40 sm:p-5">
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold">Order {r.orderReference ?? "—"}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", t.tone === "act" ? "bg-warning-soft" : "bg-muted text-muted-foreground")}>{t.title}</span>
          </span>
          <span className="block truncate text-[15px]">
            {r.reasonLabel} · {r.sellerName ?? "Seller"} · wants {r.wish === "swap" ? "a replacement" : "money back"}
          </span>
          <span className="block text-sm text-muted-foreground">Opened {timeAgo(r.createdAt)}</span>
        </span>
        <HugeiconsIcon icon={ArrowDown01Icon} className={cn("size-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>
      {expanded ? <CaseDetail id={r.id} /> : null}
    </div>
  )
}

function CaseDetail({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["return", id], queryFn: () => getReturn(id) })
  if (q.isPending) return <Skeleton className="m-4 h-40 rounded-2xl" />
  if (q.isError) return <ErrorState title="This return didn't load" error={q.error} onRetry={() => void q.refetch()} />
  const d = q.data
  const o = d.order
  return (
    <div className="space-y-4 border-t p-4 sm:p-5">
      {o ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Items</dt>
            <dd className="font-semibold">
              {o.items.map((i) => `${i.qty} × ${i.title}`).join(", ")} · <span className="tabular">{formatMinor(o.subtotalPesewas)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Payment</dt>
            <dd className="font-semibold">
              {o.paymentMethod === "cod" ? "Pay on delivery (seller holds the cash)" : o.paymentMethod === "momo" ? "Mobile money" : o.paymentMethod === "card" ? "Card" : "—"}
              {o.paidOut ? " · seller already paid out" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="font-semibold">
              {o.deliveredAt
                ? `${o.fulfillmentMethod === "pickup" ? "Collected" : "Delivered"} ${timeAgo(o.deliveredAt)} · ${o.deliveryConfirmedBy === "seller" ? "seller's word only" : "confirmed by the buyer"}`
                : o.status === "shipped"
                  ? "On the way"
                  : o.status}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Seller</dt>
            <dd className="font-semibold">{d.sellerName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Buyer</dt>
            <dd className="font-semibold [overflow-wrap:anywhere]">{d.buyerEmail}</dd>
          </div>
          {Number(o.refundedPesewas) > 0 ? (
            <div>
              <dt className="text-muted-foreground">Already refunded</dt>
              <dd className="font-semibold tabular">{formatMinor(o.refundedPesewas)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <ReturnCaseCard rc={d} viewer="admin">
        {d.status === "escalated" && o ? <Decide d={d} /> : null}
        {d.refund?.via === "provider" && d.refund.status === "failed" ? <Retry id={d.id} /> : null}
      </ReturnCaseCard>
    </div>
  )
}

function useRefresh() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "returns" || q.queryKey[0] === "return" })
}

function Decide({ d }: { d: AdminReturnDetail }) {
  const refresh = useRefresh()
  const refundable = BigInt(d.order!.subtotalPesewas) - BigInt(d.order!.refundedPesewas)
  const [outcome, setOutcome] = useState<"refund" | "declined">("refund")
  const [note, setNote] = useState("")
  const cod = d.order!.paymentMethod === "cod"
  const m = useMutation({
    mutationFn: () => decideReturn(d.id, { outcome, note: note.trim() }),
    onSuccess: () => {
      toast.success("Decided — both sides have been told.")
      refresh()
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Couldn't save the decision."),
  })
  const options = [
    { id: "refund" as const, title: `Refund the buyer · ${formatMinor(refundable)}`, line: cod ? "The seller pays the buyer back (they hold the cash)." : "Sent back through Paystack now." },
    { id: "declined" as const, title: "Side with the seller", line: "No refund; the seller's payment continues." },
  ]
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p id={`decide-${d.id}`} className="font-bold">
        Your decision
      </p>
      <div role="radiogroup" aria-labelledby={`decide-${d.id}`} className="grid gap-2 sm:grid-cols-2">
        {options.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={outcome === x.id}
            onClick={() => setOutcome(x.id)}
            className={cn("rounded-2xl border-2 p-3 text-left text-sm", outcome === x.id ? "border-foreground" : "border-border hover:border-foreground/30")}
          >
            <span className="block font-semibold">{x.title}</span>
            <span className="block text-muted-foreground">{x.line}</span>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`note-${d.id}`}>Reason (both sides see it)</Label>
        <Textarea id={`note-${d.id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The buyer's photos show the screen cracked on arrival." />
      </div>
      <Button size="lg" disabled={m.isPending || note.trim().length < 5} onClick={() => m.mutate()}>
        {m.isPending ? <Spinner /> : null} Decide
      </Button>
    </div>
  )
}

function Retry({ id }: { id: string }) {
  const refresh = useRefresh()
  const m = useMutation({
    mutationFn: () => retryRefund(id),
    onSuccess: (r) => {
      toast[r.refund?.status === "failed" ? "error" : "success"](r.refund?.status === "failed" ? "Paystack refused it again. Check the Paystack balance." : "Refund sent again.")
      refresh()
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Couldn't retry."),
  })
  return (
    <Button size="lg" variant="outline" disabled={m.isPending} onClick={() => m.mutate()}>
      {m.isPending ? <Spinner /> : null} Send the refund again
    </Button>
  )
}
