import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, ArrowRight01Icon, Megaphone01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Switch } from "@workspace/console-ui/components/switch"
import { Textarea } from "@workspace/console-ui/components/textarea"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/console-ui/components/sheet"
import { DateTimePicker } from "@workspace/console-ui/components/console/date-time-picker"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ToneBadge } from "@workspace/console-ui/components/console/status-badge"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { timeAgo } from "@workspace/console-ui/lib/money"
import type { Tone } from "@workspace/console-ui/lib/status"
import { cn } from "@workspace/console-ui/lib/utils"
import {
  addCreative,
  createCampaign,
  createTerms,
  deleteCampaign,
  getCampaign,
  getReport,
  listCampaigns,
  listPlacements,
  listTerms,
  removeCreative,
  setProducts,
  transitionCampaign,
  updateCampaign,
  type CampaignStatus,
  type Objective,
  type Transition,
} from "@/lib/campaigns"

type Tab = "live" | "upcoming" | "draft" | "ended"
const TABS: { id: Tab; label: string; statuses: CampaignStatus[] }[] = [
  { id: "live", label: "Live", statuses: ["live"] },
  { id: "upcoming", label: "Approved & in review", statuses: ["scheduled", "review"] },
  { id: "draft", label: "Drafts", statuses: ["draft"] },
  { id: "ended", label: "Ended", statuses: ["ended"] },
]

export const Route = createFileRoute("/_app/campaigns")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: TABS.some((t) => t.id === s.tab) ? (s.tab as Tab) : undefined }),
  component: CampaignsPage,
})

const STATUS: Record<CampaignStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  review: { label: "Waiting for approval", tone: "info" },
  scheduled: { label: "Approved", tone: "brand" },
  live: { label: "Live", tone: "success" },
  ended: { label: "Ended", tone: "neutral" },
}
const OBJECTIVE: Record<Objective, string> = { sale: "Sale", launch: "Launch", clearance: "Clearance", brand: "Brand" }
/** The next step from each status, in words. */
const NEXT: Record<CampaignStatus, { action: Transition; label: string; hint: string }[]> = {
  draft: [{ action: "submit", label: "Send for approval", hint: "It needs approval before buyers can see it." }],
  review: [
    { action: "approve", label: "Approve", hint: "It goes live when you publish it." },
    { action: "reopen", label: "Send back to draft", hint: "" },
  ],
  scheduled: [
    { action: "publish", label: "Go live now", hint: "Buyers see it straight away (within its dates)." },
    { action: "end", label: "Cancel", hint: "" },
  ],
  live: [{ action: "end", label: "End campaign", hint: "It stops showing immediately." }],
  ended: [],
}

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong.")
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null)

function CampaignsPage() {
  const search = Route.useSearch()
  const q = useQuery({ queryKey: ["campaigns"], queryFn: listCampaigns, staleTime: 20_000 })
  const placements = useQuery({ queryKey: ["placements"], queryFn: listPlacements, staleTime: 3_600_000 })
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const all = q.data ?? []
  const tab = search.tab ?? (all.some((c) => c.status === "live") ? "live" : "draft")
  const current = TABS.find((t) => t.id === tab)!
  const rows = all.filter((c) => current.statuses.includes(c.status))
  const placeName = (code: string) => placements.data?.find((p) => p.code === code)?.job ?? code
  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Sales and launches in homepage slots. Drafts are private; a campaign needs approval before buyers see it."
        actions={
          <Button onClick={() => setCreating(true)}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" /> New campaign
          </Button>
        }
      />
      <nav aria-label="Campaign lists" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <Link
              key={t.id}
              to="/campaigns"
              search={{ tab: t.id }}
              replace
              aria-current={active ? "page" : undefined}
              className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}
            >
              {t.label} <span className="tabular opacity-70">{all.filter((c) => t.statuses.includes(c.status)).length}</span>
            </Link>
          )
        })}
      </nav>
      {q.isPending ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Campaigns didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Megaphone01Icon} title="Nothing here yet" className="rounded-2xl border bg-card" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {rows.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setOpen(c.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/60">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {placeName(c.placementCode)} · {OBJECTIVE[c.objective]}
                    {c.startsAt || c.endsAt ? ` · ${when(c.startsAt) ?? "now"} → ${when(c.endsAt) ?? "no end"}` : ""}
                    {c.sponsored ? " · Sponsored" : ""}
                  </span>
                </span>
                <ToneBadge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</ToneBadge>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">{open ? <CampaignPanel id={open} onGone={() => setOpen(null)} /> : null}</SheetContent>
      </Sheet>
      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {creating ? (
            <CreatePanel
              onDone={(id) => {
                setCreating(false)
                setOpen(id)
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function CreatePanel({ onDone }: { onDone: (id: string) => void }) {
  const qc = useQueryClient()
  const placements = useQuery({ queryKey: ["placements"], queryFn: listPlacements, staleTime: 3_600_000 })
  const [name, setName] = useState("")
  const [placement, setPlacement] = useState("")
  const [objective, setObjective] = useState<Objective>("sale")
  const [startsAt, setStartsAt] = useState<string | null>(null)
  const [endsAt, setEndsAt] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: () => createCampaign({ name: name.trim(), placementCode: placement, objective, startsAt, endsAt }),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ["campaigns"] })
      toast.success("Draft created — add what it shows, then send it for approval.")
      onDone(c.id)
    },
    onError: (e) => toast.error(errText(e)),
  })
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-left">New campaign</SheetTitle>
        <SheetDescription className="text-left">Starts as a private draft.</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-8">
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Name</Label>
          <Input id="c-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Back to school" />
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Where it shows</legend>
          <div className="grid gap-2">
            {(placements.data ?? []).map((p) => (
              <label key={p.code} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm", placement === p.code && "border-foreground")}>
                <input type="radio" name="placement" className="mt-0.5 size-4 accent-foreground" checked={placement === p.code} onChange={() => setPlacement(p.code)} />
                <span>
                  <span className="block font-semibold">{p.job}</span>
                  <span className="block text-muted-foreground">
                    {p.maxLive === 1 ? "One at a time" : `Up to ${p.maxLive} at once`}
                    {p.constraints.requiresImage ? " · needs an image" : ""}
                    {p.constraints.minProducts ? ` · at least ${p.constraints.minProducts} product${p.constraints.minProducts === 1 ? "" : "s"}` : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="c-obj">Goal</Label>
          <select id="c-obj" value={objective} onChange={(e) => setObjective(e.target.value as Objective)} className="h-10 w-full rounded-4xl border bg-input/30 px-3 text-sm">
            {(Object.keys(OBJECTIVE) as Objective[]).map((o) => (
              <option key={o} value={o}>
                {OBJECTIVE[o]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-start">Starts</Label>
            <DateTimePicker id="c-start" value={startsAt} onChange={setStartsAt} min={new Date()} placeholder="When approved" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-end">Ends</Label>
            <DateTimePicker id="c-end" value={endsAt} onChange={setEndsAt} min={startsAt ? new Date(startsAt) : new Date()} placeholder="No end date" />
          </div>
        </div>
        <Button disabled={!name.trim() || !placement || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Spinner /> : null} Create draft
        </Button>
      </div>
    </>
  )
}

function CampaignPanel({ id, onGone }: { id: string; onGone: () => void }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["campaign", id], queryFn: () => getCampaign(id) })
  const report = useQuery({ queryKey: ["campaign-report", id], queryFn: () => getReport(id), staleTime: 60_000 })
  const terms = useQuery({ queryKey: ["terms"], queryFn: listTerms, staleTime: 300_000 })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["campaign", id] })
    void qc.invalidateQueries({ queryKey: ["campaigns"] })
  }
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e) => toast.error(errText(e)),
  })
  const [creative, setCreative] = useState({ title: "", subtitle: "", imageUrl: "", link: "" })
  const [ids, setIds] = useState<string | null>(null)
  const [newTerms, setNewTerms] = useState<{ label: string; summary: string } | null>(null)
  if (q.isPending) return <Skeleton className="m-4 h-64 rounded-xl" />
  if (q.isError) return <ErrorState title="Couldn't load this campaign" error={q.error} onRetry={() => void q.refetch()} />
  const { campaign: c, creatives, productSet, audit } = q.data
  const editable = c.status === "draft"
  const productText = ids ?? (productSet?.productIds ?? []).join("\n")
  const r = report.data
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex flex-wrap items-center gap-2 text-left">
          {c.name} <ToneBadge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</ToneBadge>
        </SheetTitle>
        <SheetDescription className="text-left">
          Tracking ID <span className="font-mono">{c.trackingId}</span>
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-8">
        {NEXT[c.status].length ? (
          <div className="space-y-2 rounded-2xl bg-muted p-4">
            <div className="flex flex-wrap gap-2">
              {NEXT[c.status].map((n, i) => (
                <Button
                  key={n.action}
                  variant={i === 0 ? "brand" : "outline"}
                  disabled={act.isPending}
                  onClick={() => act.mutate(() => transitionCampaign(id, n.action).then(() => toast.success(`${n.label} — done.`)))}
                >
                  {n.label}
                </Button>
              ))}
            </div>
            {NEXT[c.status][0]?.hint ? <p className="text-sm text-muted-foreground">{NEXT[c.status][0]!.hint}</p> : null}
          </div>
        ) : null}

        {r && (c.status === "live" || c.status === "ended") ? (
          <dl className="grid grid-cols-3 gap-3 rounded-2xl border p-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Seen</dt>
              <dd className="text-xl font-bold tabular">{r.views.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Clicked</dt>
              <dd className="text-xl font-bold tabular">{r.selects.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Click rate</dt>
              <dd className="text-xl font-bold tabular">{r.views ? `${((r.selects / r.views) * 100).toFixed(1)}%` : "—"}</dd>
            </div>
          </dl>
        ) : null}

        <section aria-labelledby="dates" className="grid gap-3 sm:grid-cols-2">
          <h3 id="dates" className="sr-only">
            Dates
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="d-start">Starts</Label>
            <DateTimePicker id="d-start" value={c.startsAt} onChange={(v) => act.mutate(() => updateCampaign(id, { startsAt: v }))} placeholder="When approved" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-end">Ends</Label>
            <DateTimePicker id="d-end" value={c.endsAt} onChange={(v) => act.mutate(() => updateCampaign(id, { endsAt: v }))} placeholder="No end date" />
          </div>
          <label className="flex items-center justify-between gap-3 text-sm font-medium sm:col-span-2">
            Mark as sponsored (a seller paid for it)
            <Switch checked={c.sponsored} onCheckedChange={(v) => act.mutate(() => updateCampaign(id, { sponsored: v }))} />
          </label>
        </section>

        <section aria-labelledby="creatives" className="space-y-2">
          <h3 id="creatives" className="font-semibold">
            What buyers see
          </h3>
          <ul className="space-y-2">
            {creatives.map((cr) => (
              <li key={cr.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                {cr.imageUrl ? <img src={cr.imageUrl} alt="" className="size-14 rounded-lg object-cover" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{cr.title}</span>
                  <span className="block truncate text-muted-foreground">{[cr.subtitle, cr.link].filter(Boolean).join(" · ")}</span>
                </span>
                {editable ? (
                  <Button size="sm" variant="ghost" onClick={() => act.mutate(() => removeCreative(id, cr.id))}>
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {editable ? (
            <div className="space-y-2 rounded-xl border border-dashed p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input aria-label="Headline" placeholder="Headline" maxLength={120} value={creative.title} onChange={(e) => setCreative({ ...creative, title: e.target.value })} />
                <Input aria-label="Subheading" placeholder="Subheading (optional)" maxLength={200} value={creative.subtitle} onChange={(e) => setCreative({ ...creative, subtitle: e.target.value })} />
                <Input aria-label="Image URL" placeholder="Image https://…" value={creative.imageUrl} onChange={(e) => setCreative({ ...creative, imageUrl: e.target.value })} />
                <Input aria-label="Link" placeholder="Link, e.g. /categories/phones" value={creative.link} onChange={(e) => setCreative({ ...creative, link: e.target.value })} />
              </div>
              <Button
                size="sm"
                disabled={!creative.title.trim() || act.isPending}
                onClick={() =>
                  act.mutate(() =>
                    addCreative(id, { title: creative.title.trim(), subtitle: creative.subtitle.trim() || null, imageUrl: creative.imageUrl.trim() || null, link: creative.link.trim() || null }).then(() =>
                      setCreative({ title: "", subtitle: "", imageUrl: "", link: "" }),
                    ),
                  )
                }
              >
                Add
              </Button>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="products" className="space-y-1.5">
          <Label htmlFor="c-products" id="products">
            Products in this campaign (IDs, one per line)
          </Label>
          <Textarea id="c-products" rows={4} className="font-mono text-sm" disabled={!editable} value={productText} onChange={(e) => setIds(e.target.value)} />
          {editable && ids != null ? (
            <Button size="sm" disabled={act.isPending} onClick={() => act.mutate(() => setProducts(id, productText.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)).then(() => setIds(null)))}>
              Save products
            </Button>
          ) : null}
        </section>

        <section aria-labelledby="terms" className="space-y-2">
          <Label htmlFor="c-terms" id="terms">
            Offer terms buyers can read
          </Label>
          <select
            id="c-terms"
            value={c.termsId ?? ""}
            disabled={!editable}
            onChange={(e) => act.mutate(() => updateCampaign(id, { termsId: e.target.value || null }))}
            className="h-10 w-full rounded-4xl border bg-input/30 px-3 text-sm"
          >
            <option value="">No terms</option>
            {(terms.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {editable ? (
            newTerms ? (
              <div className="space-y-2 rounded-xl border p-3">
                <Input aria-label="Terms name" placeholder="Name, e.g. 20% off phones" value={newTerms.label} onChange={(e) => setNewTerms({ ...newTerms, label: e.target.value })} />
                <Textarea aria-label="Terms summary" rows={2} placeholder="What buyers get, and any limits" value={newTerms.summary} onChange={(e) => setNewTerms({ ...newTerms, summary: e.target.value })} />
                <Button
                  size="sm"
                  disabled={!newTerms.label.trim() || !newTerms.summary.trim() || act.isPending}
                  onClick={() =>
                    act.mutate(async () => {
                      const t = await createTerms({ label: newTerms.label.trim(), summary: newTerms.summary.trim() })
                      await updateCampaign(id, { termsId: t.id })
                      setNewTerms(null)
                      void qc.invalidateQueries({ queryKey: ["terms"] })
                    })
                  }
                >
                  Save terms
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setNewTerms({ label: "", summary: "" })}>
                Write new terms
              </Button>
            )
          ) : null}
        </section>

        {audit.length ? (
          <section aria-labelledby="history" className="space-y-1">
            <h3 id="history" className="font-semibold">
              History
            </h3>
            <ol className="space-y-1 border-l-2 pl-4 text-sm">
              {audit.map((a) => (
                <li key={a.id}>
                  <span className="font-semibold">{a.action.replace(/^campaign\./, "").replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground"> · {timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {c.status === "draft" ? (
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() =>
              act.mutate(() =>
                deleteCampaign(id).then(() => {
                  toast.success("Draft deleted.")
                  onGone()
                }),
              )
            }
          >
            Delete draft
          </Button>
        ) : null}
      </div>
    </>
  )
}

