import { useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, ArrowRight01Icon, CheckmarkCircle02Icon, ImageNotFound01Icon, SparklesIcon, UserIcon } from "@hugeicons/core-free-icons"
import { checkListing } from "@alkemart/domain"
import { Button } from "@workspace/console-ui/components/button"
import { Checkbox } from "@workspace/console-ui/components/checkbox"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Textarea } from "@workspace/console-ui/components/textarea"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/console-ui/components/sheet"
import { ToggleGroup, ToggleGroupItem } from "@workspace/console-ui/components/toggle-group"
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
import { cn } from "@workspace/console-ui/lib/utils"
import {
  decideListing,
  getListing,
  getReviewMode,
  listListings,
  listTaxonomy,
  listingReviews,
  setReviewMode,
  type AdminListing,
  type Decision,
  type ListingReview,
  type ReviewMode,
  type ReviewReason,
} from "@/lib/api"
import { awaitsReview, qk } from "@/lib/queries"
import { thumbFallback, thumbOf } from "@alkemart/shared/media"

type Tab = "review" | "sent-back" | "rejected" | "live"
const TABS: { id: Tab; label: string }[] = [
  { id: "review", label: "Needs review" },
  { id: "sent-back", label: "Sent back" },
  { id: "rejected", label: "Rejected" },
  { id: "live", label: "Live" },
]

export const Route = createFileRoute("/_app/listings")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: TABS.some((t) => t.id === s.tab) ? (s.tab as Tab) : undefined }),
  component: ListingsPage,
})

/** Which queue a listing sits in, from its status and latest review. */
function tabOf(l: AdminListing): Tab | null {
  if (l.status === "published") return "live"
  if (l.status === "rejected") return "rejected"
  if (l.status === "proposed") return awaitsReview(l) ? "review" : "sent-back"
  return null
}

/** Reason presets: what operators say most, in words sellers can act on. */
const PRESETS: { code: string; message: string; for: Decision[] }[] = [
  { code: "photo_not_item", message: "Photos must show the actual item you're selling.", for: ["request_changes", "reject"] },
  { code: "photo_quality", message: "Photos are too dark or blurry — retake them in daylight.", for: ["request_changes"] },
  { code: "title_unclear", message: "Make the name specific: brand, model, size or colour.", for: ["request_changes"] },
  { code: "wrong_category", message: "This is in the wrong category — move it to the closest match.", for: ["request_changes"] },
  { code: "price_unrealistic", message: "The price looks wrong (an extra or missing zero?). Please check it.", for: ["request_changes"] },
  { code: "missing_details", message: "Add key details buyers need: condition, size and what's in the box.", for: ["request_changes"] },
  { code: "contact_details", message: "Remove phone numbers, links and social handles from the listing.", for: ["request_changes", "reject"] },
  { code: "duplicate", message: "You already have this listing — update the existing one instead.", for: ["reject"] },
  { code: "counterfeit", message: "Replica or counterfeit branded goods can't be sold on alkemart.", for: ["reject"] },
  { code: "prohibited_item", message: "This item isn't allowed on alkemart.", for: ["reject"] },
]

const MODE_COPY: Record<ReviewMode, { label: string; body: string }> = {
  trust: { label: "Trust shops", body: "Listings that pass every rule go live at once. Anything flagged waits here for a person." },
  manual: { label: "Manual", body: "Every listing waits for a person. Rule checks still send back obvious problems." },
  assist: { label: "AI assists", body: "AI reviews each listing and leaves its opinion here. A person decides." },
  auto: { label: "AI decides", body: "AI approves only clean, confident listings; anything unusual waits for a person. You can overturn any decision." },
}

function ListingsPage() {
  const { tab = "review" } = Route.useSearch()
  const q = useQuery({ queryKey: qk.listings("all"), queryFn: () => listListings(), staleTime: 20_000 })
  const [open, setOpen] = useState<AdminListing | null>(null)
  const all = q.data ?? []
  const counts = new Map<Tab, number>()
  for (const l of all) {
    const t = tabOf(l)
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  // Oldest first in the queue (fairness); newest first elsewhere.
  const rows = all
    .filter((l) => tabOf(l) === tab)
    .sort((a, b) => {
      const at = new Date(a.review?.createdAt ?? 0).getTime()
      const bt = new Date(b.review?.createdAt ?? 0).getTime()
      return tab === "review" ? at - bt : bt - at
    })

  return (
    <div className="space-y-6">
      <PageHeader title="Listings" description="Listings that need a person, and every listing on the marketplace." />
      <ModeSwitch />

      <nav aria-label="Listing queues" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <Link
              key={t.id}
              to="/listings"
              search={{ tab: t.id }}
              replace
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold",
                active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
              )}
            >
              {t.label}
              <span className={cn("tabular", active ? "text-background/70" : "text-muted-foreground")}>{counts.get(t.id) ?? 0}</span>
            </Link>
          )
        })}
      </nav>

      {q.isPending ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Listings didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CheckmarkCircle02Icon}
          title={tab === "review" ? "Nothing waiting — all caught up" : "Nothing here"}
          className="rounded-2xl border bg-card"
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {rows.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => setOpen(l)} className="flex w-full items-center gap-4 p-3 text-left hover:bg-muted/60 sm:p-4">
                <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface">
                  {l.imageUrl ? <img src={thumbOf(l.imageUrl) ?? l.imageUrl} alt="" className="size-full object-cover" loading="lazy" onError={thumbFallback(l.imageUrl)} /> : <HugeiconsIcon icon={ImageNotFound01Icon} className="size-6 text-muted-foreground" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate font-semibold">{l.title}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{l.sellerName ?? "Unknown shop"}</span>
                    {l.review ? <span>{timeAgo(l.review.createdAt)}</span> : null}
                    {l.flags.map((f) => (
                      <ToneBadge key={f.rule} tone={f.rule === "banned-words" ? "danger" : "warning"}>
                        {f.rule.replace(/-/g, " ")}
                      </ToneBadge>
                    ))}
                    <AiChip review={l.review} />
                  </span>
                </span>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {open ? <ListingPanel key={open.id} listing={open} onDone={() => setOpen(null)} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function AiChip({ review }: { review: ListingReview | null }) {
  if (!review || review.reviewer !== "ai" || review.confidence == null) return null
  const verdict = review.note?.replace("AI advice: ", "") ?? review.decision
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-xs font-semibold text-info">
      <HugeiconsIcon icon={SparklesIcon} className="size-3.5" aria-hidden /> AI: {verdict} · {Math.round(review.confidence * 100)}%
    </span>
  )
}

function ModeSwitch() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["review-mode"], queryFn: getReviewMode })
  const [pending, setPending] = useState<ReviewMode | null>(null)
  const save = useMutation({
    mutationFn: setReviewMode,
    onSuccess: (m) => {
      qc.setQueryData(["review-mode"], m)
      setPending(null)
      toast.success(`Review mode: ${MODE_COPY[m].label}`)
    },
    onError: () => toast.error("Couldn't change the review mode."),
  })
  const mode = q.data
  return (
    <section aria-labelledby="mode-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 id="mode-title" className="flex items-center gap-2 font-bold">
          <HugeiconsIcon icon={SparklesIcon} className="size-5" aria-hidden /> Who reviews listings
        </h2>
        <p className="text-sm text-muted-foreground">{mode ? MODE_COPY[mode].body : " "}</p>
      </div>
      {q.isPending ? (
        <Skeleton className="h-10 w-72" />
      ) : (
        <ToggleGroup
          type="single"
          variant="outline"
          className="flex-wrap justify-start"
          value={mode}
          onValueChange={(v) => {
            if (!v || v === mode) return
            if (v === "auto") setPending("auto")
            else save.mutate(v as ReviewMode)
          }}
          aria-label="Review mode"
        >
          {(Object.keys(MODE_COPY) as ReviewMode[]).map((m) => (
            <ToggleGroupItem key={m} value={m} className="min-h-10 px-3.5">
              {MODE_COPY[m].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <AlertDialog open={pending === "auto"} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Let AI approve clear listings?</AlertDialogTitle>
            <AlertDialogDescription>
              AI will publish only listings that pass every rule, have no flags, and that it approves with high confidence. Anything
              unusual still waits for a person, and every decision is logged and can be overturned here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current mode</AlertDialogCancel>
            <AlertDialogAction onClick={() => save.mutate("auto")}>Turn on</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

const DECISION_LABEL: Record<ListingReview["decision"], string> = {
  submitted: "Sent for review",
  approve: "Approved",
  reject: "Rejected",
  request_changes: "Sent back for changes",
  escalate: "Waiting for a person",
}
const WHO: Record<ListingReview["reviewer"], string> = { seller: "Seller", system: "Rule check", ai: "AI", admin: "Team" }

function ListingPanel({ listing, onDone }: { listing: AdminListing; onDone: () => void }) {
  const qc = useQueryClient()
  const detail = useQuery({ queryKey: ["listing", listing.id], queryFn: () => getListing(listing.id) })
  const history = useQuery({ queryKey: ["listing-reviews", listing.id], queryFn: () => listingReviews(listing.id) })
  const tax = useQuery({ queryKey: ["taxonomy"], queryFn: listTaxonomy, staleTime: 600_000 })
  const category = tax.data?.find((n) => n.id === listing.primaryCategoryId)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState("")
  const d = detail.data
  const combos = useMemo(
    () => (d ? (d.variants.length ? d.variants : [{ variant: { id: "base", sku: null }, offer: d.offer, options: {} }]) : []),
    [d],
  )
  const findings = useMemo(
    () =>
      d
        ? checkListing({
            title: d.product.title,
            description: d.product.description,
            imageCount: d.images.length || (d.product.imageUrl ? 1 : 0),
            prices: combos.filter((c) => c.offer.active).map((c) => Number(c.offer.pricePesewas)),
            categoryId: d.product.primaryCategoryId,
          })
        : [],
    [d, combos],
  )
  const decide = useMutation({
    mutationFn: () => {
      const reasons: ReviewReason[] = PRESETS.filter((p) => picked.includes(p.code)).map((p) => ({ code: p.code, message: p.message }))
      return decideListing(listing.id, decision!, { reasons, note: note.trim() || null })
    },
    onSuccess: () => {
      toast.success(decision === "approve" ? "Approved — it's live." : decision === "reject" ? "Rejected. The seller can see why." : "Sent back with your notes.")
      void qc.invalidateQueries({ queryKey: ["listings"] })
      onDone()
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't save the decision."),
  })
  const needsReasons = decision === "request_changes" || decision === "reject"
  const canSubmit = decision === "approve" || (needsReasons && (picked.length > 0 || note.trim().length > 0))
  const images = d ? (d.images.length ? d.images.map((i) => i.url) : d.product.imageUrl ? [d.product.imageUrl] : []) : []
  const aiRow = history.data?.find((r) => r.reviewer === "ai")

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-8 text-left">{listing.title}</SheetTitle>
        <SheetDescription className="flex items-center gap-1.5 text-left">
          <HugeiconsIcon icon={UserIcon} className="size-4" aria-hidden /> {listing.sellerName ?? "Unknown shop"}
          {category ? <span>· {category.displayName ?? category.canonicalName}</span> : null}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-6 px-4 pb-8">
        {detail.isPending ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : detail.isError ? (
          <ErrorState title="This listing didn't load" error={detail.error} onRetry={() => void detail.refetch()} />
        ) : d ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.length ? (
                images.map((u) => <img key={u} src={u} alt="" className="size-32 shrink-0 rounded-xl object-cover" />)
              ) : (
                <p className="text-sm text-destructive">No photos.</p>
              )}
            </div>
            {d.product.description ? <p className="text-[15px] whitespace-pre-line">{d.product.description}</p> : <p className="text-sm text-muted-foreground">No description.</p>}
            <table className="w-full text-sm">
              <caption className="sr-only">Options, prices and stock</caption>
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="pb-1 font-medium">Option</th>
                  <th scope="col" className="pb-1 text-right font-medium">Price</th>
                  <th scope="col" className="pb-1 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {combos.map((c) => (
                  <tr key={c.variant.id} className={cn(!c.offer.active && "text-muted-foreground line-through")}>
                    <td className="py-1.5">{Object.values(c.options).join(" · ") || "—"}{c.offer.condition ? ` (${c.offer.condition.replace(/_/g, " ")})` : ""}</td>
                    <td className="py-1.5 text-right tabular">{formatMinor(c.offer.pricePesewas)}</td>
                    <td className="py-1.5 text-right tabular">{c.offer.onHand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        {findings.length || listing.flags.length || aiRow ? (
          <section aria-labelledby="checks-title" className="space-y-2">
            <h3 id="checks-title" className="font-semibold">
              Checks
            </h3>
            <ul className="space-y-1.5 text-sm">
              {findings.map((f) => (
                <li key={f.code} className={cn("rounded-xl p-2.5", f.severity === "block" ? "bg-danger-soft text-destructive" : f.severity === "fix" ? "bg-warning-soft text-warning" : "bg-muted")}>
                  <HugeiconsIcon icon={Alert02Icon} className="mr-1.5 inline size-4" aria-hidden />
                  {f.message}
                </li>
              ))}
              {listing.flags.map((f) => (
                <li key={f.rule} className="rounded-xl bg-warning-soft p-2.5 text-warning">
                  {f.message}
                </li>
              ))}
              {aiRow ? (
                <li className="rounded-xl bg-info-soft p-2.5 text-info">
                  <HugeiconsIcon icon={SparklesIcon} className="mr-1.5 inline size-4" aria-hidden />
                  AI ({Math.round((aiRow.confidence ?? 0) * 100)}% sure): {aiRow.note?.replace("AI advice: ", "") ?? aiRow.decision}
                  {aiRow.reasons.length ? ` — ${aiRow.reasons.map((r) => r.message).join(" ")}` : ""}
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="hist-title" className="space-y-2">
          <h3 id="hist-title" className="font-semibold">
            History
          </h3>
          {history.isPending ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : (
            <ol className="space-y-2 text-sm">
              {(history.data ?? []).map((r) => (
                <li key={r.id} className="rounded-xl border p-2.5">
                  <p className="font-semibold">
                    {DECISION_LABEL[r.decision]} · <span className="font-normal text-muted-foreground">{WHO[r.reviewer]} · {timeAgo(r.createdAt)}</span>
                  </p>
                  {r.reasons.length ? <p className="text-muted-foreground">{r.reasons.map((x) => x.message).join(" ")}</p> : null}
                  {r.note && r.reviewer === "admin" ? <p className="italic">“{r.note}”</p> : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        {listing.status !== "draft" ? (
          <section aria-labelledby="decide-title" className="space-y-3 rounded-2xl border p-4">
            <h3 id="decide-title" className="font-semibold">
              Decision
            </h3>
            <ToggleGroup type="single" variant="outline" value={decision ?? ""} onValueChange={(v) => { setDecision((v || null) as Decision | null); setPicked([]) }} className="flex-wrap justify-start">
              <ToggleGroupItem value="approve" className="min-h-10 px-3.5">Approve</ToggleGroupItem>
              <ToggleGroupItem value="request_changes" className="min-h-10 px-3.5">Request changes</ToggleGroupItem>
              <ToggleGroupItem value="reject" className="min-h-10 px-3.5">Reject</ToggleGroupItem>
            </ToggleGroup>
            {needsReasons ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Tell the seller why (they see this)</legend>
                {PRESETS.filter((p) => p.for.includes(decision!)).map((p) => (
                  <label key={p.code} className="flex items-start gap-2.5 text-sm">
                    <Checkbox checked={picked.includes(p.code)} onCheckedChange={(v) => setPicked((xs) => (v ? [...xs, p.code] : xs.filter((x) => x !== p.code)))} className="mt-0.5" />
                    {p.message}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {decision ? (
              <div className="space-y-1.5">
                <Label htmlFor="decide-note">Note to the seller {decision === "approve" ? "(optional)" : ""}</Label>
                <Textarea id="decide-note" rows={2} value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} />
              </div>
            ) : null}
            <Button variant={decision === "approve" ? "brand" : "default"} size="lg" disabled={!canSubmit || decide.isPending} onClick={() => decide.mutate()}>
              {decide.isPending ? <Spinner /> : null}
              {decision === "approve" ? "Approve and publish" : decision === "reject" ? "Reject" : decision === "request_changes" ? "Send back" : "Choose a decision"}
            </Button>
          </section>
        ) : null}
      </div>
    </>
  )
}
