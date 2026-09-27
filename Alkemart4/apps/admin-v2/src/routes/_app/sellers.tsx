import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, CheckmarkBadge01Icon, LinkSquare02Icon, Search01Icon, Store01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Textarea } from "@workspace/console-ui/components/textarea"
import { ToggleGroup, ToggleGroupItem } from "@workspace/console-ui/components/toggle-group"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/console-ui/components/sheet"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ToneBadge } from "@workspace/console-ui/components/console/status-badge"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { formatMinor, timeAgo } from "@workspace/console-ui/lib/money"
import type { Tone } from "@workspace/console-ui/lib/status"
import { cn } from "@workspace/console-ui/lib/utils"
import { listSellers, type AdminSeller } from "@/lib/api"
import { getStorefrontUrl } from "@/lib/env"
import {
  approveSeller,
  getSeller,
  issueVerification,
  listVerifications,
  revokeVerification,
  setCommission,
  suspendSeller,
  unsuspendSeller,
  type SellerStatus,
  type Verification,
} from "@/lib/ops"

type Tab = "applications" | "active" | "suspended" | "all"
const TABS: { id: Tab; label: string; match: (s: SellerStatus) => boolean }[] = [
  { id: "applications", label: "Applications", match: (s) => s === "pending_approval" },
  { id: "active", label: "Active", match: (s) => s === "open" },
  { id: "suspended", label: "Suspended", match: (s) => s === "suspended" || s === "terminated" },
  { id: "all", label: "All", match: () => true },
]

export const Route = createFileRoute("/_app/sellers")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: TABS.some((t) => t.id === s.tab) ? (s.tab as Tab) : undefined }),
  component: SellersPage,
})

const STATUS: Record<SellerStatus, { label: string; tone: Tone }> = {
  pending_approval: { label: "Applied", tone: "info" },
  open: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "warning" },
  terminated: { label: "Closed", tone: "neutral" },
}

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong.")

function SellersPage() {
  const search = Route.useSearch()
  const q = useQuery({ queryKey: ["sellers"], queryFn: listSellers, staleTime: 30_000 })
  const [term, setTerm] = useState("")
  const [open, setOpen] = useState<AdminSeller | null>(null)
  const all = q.data ?? []
  const pending = all.filter((s) => s.status === "pending_approval").length
  const tab = search.tab ?? (pending ? "applications" : "active")
  const current = TABS.find((t) => t.id === tab)!
  const needle = term.trim().toLowerCase()
  const rows = all
    .filter((s) => current.match(s.status))
    .filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.handle.includes(needle) || s.ownerEmail?.toLowerCase().includes(needle))
  return (
    <div className="space-y-6">
      <PageHeader title="Sellers" description="Approve shops, set commission, and decide which trust badges buyers see." />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Seller lists" className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <Link
                key={t.id}
                to="/sellers"
                search={{ tab: t.id }}
                replace
                aria-current={active ? "page" : undefined}
                className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}
              >
                {t.label} <span className="tabular opacity-70">{all.filter((s) => t.match(s.status)).length}</span>
              </Link>
            )
          })}
        </nav>
        <div className="relative lg:w-72">
          <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search sellers" placeholder="Shop, handle or email" className="pl-9" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      </div>
      {q.isPending ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Sellers didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Store01Icon} title={tab === "applications" ? "No applications waiting" : "No sellers here"} className="rounded-2xl border bg-card" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {rows.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setOpen(s)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/60">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    @{s.handle} · {s.ownerEmail ?? "no email"}
                  </span>
                </span>
                <span className="hidden text-right text-sm sm:block">
                  <span className="block font-semibold tabular">{formatMinor(s.gmvPesewas)}</span>
                  <span className="block text-muted-foreground">{s.orderCount} orders</span>
                </span>
                <ToneBadge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</ToneBadge>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">{open ? <SellerPanel id={open.id} /> : null}</SheetContent>
      </Sheet>
    </div>
  )
}

const KIND_LABEL: Record<Verification["kind"], string> = {
  contact: "Contact verified",
  identity: "ID verified",
  business: "Registered business",
  brand_auth: "Authorised seller",
  fulfillment_proven: "Proven delivery",
}

function SellerPanel({ id }: { id: string }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["seller", id], queryFn: () => getSeller(id) })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["seller", id] })
    void qc.invalidateQueries({ queryKey: ["sellers"] })
  }
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => refresh(),
    onError: (e) => toast.error(errText(e)),
  })
  const [suspending, setSuspending] = useState(false)
  const [reason, setReason] = useState("")
  const [pct, setPct] = useState<string | null>(null)
  if (q.isPending) return <Skeleton className="m-4 h-64 rounded-xl" />
  if (q.isError) return <ErrorState title="Couldn't load this seller" error={q.error} onRetry={() => void q.refetch()} />
  const { seller: s, counts } = q.data
  const pctValue = pct ?? String(s.commissionBps / 100)
  const bps = Math.round(Number(pctValue) * 100)
  const pctValid = Number.isFinite(bps) && bps >= 0 && bps <= 5000
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 text-left">
          {s.name} <ToneBadge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</ToneBadge>
        </SheetTitle>
        <SheetDescription className="text-left">
          @{s.handle} · {s.email ?? "no email"} · joined {timeAgo(s.created_at)}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-8">
        <div className="flex flex-wrap gap-2">
          {s.status === "pending_approval" ? (
            <Button variant="brand" disabled={act.isPending} onClick={() => act.mutate(() => approveSeller(id).then(() => toast.success(`${s.name} is live — they can sell now.`)))}>
              Approve shop
            </Button>
          ) : null}
          {s.status === "open" ? (
            <Button variant="outline" onClick={() => setSuspending(true)}>
              Suspend
            </Button>
          ) : null}
          {s.status === "suspended" ? (
            <Button variant="outline" disabled={act.isPending} onClick={() => act.mutate(() => unsuspendSeller(id).then(() => toast.success("Shop reopened.")))}>
              Reopen shop
            </Button>
          ) : null}
          <Button asChild variant="ghost">
            <a href={`${getStorefrontUrl()}/shops/${s.handle}`} target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={LinkSquare02Icon} data-icon="inline-start" /> View shop
            </a>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/payouts">Payouts & holds</Link>
          </Button>
        </div>
        {suspending ? (
          <div className="space-y-2 rounded-2xl border border-warning p-4">
            <Label htmlFor="suspend-reason">Why suspend {s.name}? (recorded)</Label>
            <Textarea id="suspend-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="text-xs text-muted-foreground">Their listings stop selling until you reopen the shop.</p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={!reason.trim() || act.isPending}
                onClick={() =>
                  act.mutate(() =>
                    suspendSeller(id, reason.trim()).then(() => {
                      setSuspending(false)
                      setReason("")
                      toast.success("Shop suspended.")
                    }),
                  )
                }
              >
                {act.isPending ? <Spinner /> : null} Suspend shop
              </Button>
              <Button variant="ghost" onClick={() => setSuspending(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-4">
          {(["published", "proposed", "rejected", "draft"] as const).map((k) => (
            <div key={k}>
              <dt className="text-muted-foreground capitalize">{k === "proposed" ? "In review" : k === "published" ? "Live" : k}</dt>
              <dd className="text-lg font-bold tabular">{counts.products[k] ?? 0}</dd>
            </div>
          ))}
          {counts.partial ? <p className="col-span-full text-xs text-warning">Some numbers couldn't load and may be incomplete.</p> : null}
        </dl>

        <section aria-labelledby="commission" className="space-y-2 rounded-2xl border p-4">
          <h3 id="commission" className="font-semibold">
            Commission
          </h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="pct">Percent of each sale</Label>
              <Input id="pct" inputMode="decimal" className="w-28 tabular" value={pctValue} onChange={(e) => setPct(e.target.value)} aria-invalid={!pctValid || undefined} />
            </div>
            {pct != null && bps !== s.commissionBps ? (
              <Button
                disabled={!pctValid || act.isPending}
                onClick={() =>
                  act.mutate(() =>
                    setCommission(id, bps).then(() => {
                      setPct(null)
                      toast.success(`Commission is now ${bps / 100}%. It applies to new payouts.`)
                    }),
                  )
                }
              >
                Save
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">Changes are logged with your name and apply to payouts made from now on.</p>
        </section>

        <section aria-labelledby="payout-acct" className="rounded-2xl border p-4 text-sm">
          <h3 id="payout-acct" className="mb-1 font-semibold">
            Payout account
          </h3>
          {s.momo ? (
            <p>
              {s.momo.provider?.toUpperCase()} •••• {s.momo.phone.slice(-4)} ·{" "}
              {s.momo.recipient ? <span className="text-success">Registered with Paystack</span> : <span className="text-warning">Not registered with Paystack</span>}
            </p>
          ) : (
            <p className="text-warning">No MoMo number yet — they can't be paid.</p>
          )}
        </section>

        <Verifications sellerId={id} />
      </div>
    </>
  )
}

function Verifications({ sellerId }: { sellerId: string }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["verifications", sellerId], queryFn: () => listVerifications(sellerId) })
  const [kind, setKind] = useState<Verification["kind"]>("contact")
  const [evidence, setEvidence] = useState("")
  const [revoking, setRevoking] = useState<string | null>(null)
  const [why, setWhy] = useState("")
  const refresh = () => void qc.invalidateQueries({ queryKey: ["verifications", sellerId] })
  const issue = useMutation({
    mutationFn: () => issueVerification(sellerId, { kind, evidence: evidence.trim() || null }),
    onSuccess: () => {
      setEvidence("")
      refresh()
      toast.success("Badge issued — buyers see it on the shop page.")
    },
    onError: (e) => toast.error(errText(e)),
  })
  const revoke = useMutation({
    mutationFn: (vid: string) => revokeVerification(sellerId, vid, why.trim()),
    onSuccess: () => {
      setRevoking(null)
      setWhy("")
      refresh()
      toast.success("Badge removed.")
    },
    onError: (e) => toast.error(errText(e)),
  })
  const active = (q.data ?? []).filter((v) => v.status === "verified")
  return (
    <section aria-labelledby="verif" className="space-y-3 rounded-2xl border p-4">
      <h3 id="verif" className="flex items-center gap-2 font-semibold">
        <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-5" aria-hidden /> Trust badges
      </h3>
      <p className="text-sm text-muted-foreground">Only issue a badge you've checked. Each one tells buyers something specific.</p>
      {q.isPending ? (
        <Skeleton className="h-12 rounded-xl" />
      ) : (
        <ul className="space-y-2">
          {(q.data ?? []).length === 0 ? <li className="text-sm text-muted-foreground">No badges yet.</li> : null}
          {(q.data ?? []).map((v) => (
            <li key={v.id} className="space-y-1 rounded-xl border p-3 text-sm">
              <p className="flex items-center justify-between gap-2">
                <span className="font-semibold">{KIND_LABEL[v.kind]}</span>
                <ToneBadge tone={v.status === "verified" ? "success" : "neutral"}>{v.status}</ToneBadge>
              </p>
              <p className="text-muted-foreground">Buyers read: “{v.meaning}”</p>
              {v.evidence ? <p className="text-muted-foreground">Evidence: {v.evidence}</p> : null}
              {v.status === "verified" ? (
                revoking === v.id ? (
                  <div className="space-y-2 pt-1">
                    <Label htmlFor={`why-${v.id}`}>Why remove it?</Label>
                    <Input id={`why-${v.id}`} value={why} onChange={(e) => setWhy(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" disabled={!why.trim() || revoke.isPending} onClick={() => revoke.mutate(v.id)}>
                        Remove badge
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRevoking(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setRevoking(v.id)}>
                    Remove
                  </Button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2 border-t pt-3">
        <p className="text-sm font-medium">Issue a badge</p>
        <ToggleGroup type="single" variant="outline" value={kind} onValueChange={(v) => v && setKind(v as Verification["kind"])} className="flex-wrap justify-start">
          {(Object.keys(KIND_LABEL) as Verification["kind"][])
            .filter((k) => !active.some((v) => v.kind === k))
            .map((k) => (
              <ToggleGroupItem key={k} value={k} className="min-h-10 px-3">
                {KIND_LABEL[k]}
              </ToggleGroupItem>
            ))}
        </ToggleGroup>
        <Label htmlFor="evidence">What you checked (kept private)</Label>
        <Input id="evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="e.g. Ghana Card GHA-… checked on a video call" />
        <Button disabled={issue.isPending || active.some((v) => v.kind === kind)} onClick={() => issue.mutate()}>
          {issue.isPending ? <Spinner /> : null} Issue {KIND_LABEL[kind]}
        </Button>
      </div>
    </section>
  )
}
