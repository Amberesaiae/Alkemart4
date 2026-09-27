import { useEffect, useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, ArrowDown01Icon, ArrowUp01Icon, Copy01Icon, Delete02Icon, EyeIcon, PencilEdit01Icon } from "@hugeicons/core-free-icons"
import type { HomeSection, HomeSectionType, HomepageDocument } from "@alkemart/shared/homepage"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Switch } from "@workspace/console-ui/components/switch"
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
import { DateTimePicker } from "@workspace/console-ui/components/console/date-time-picker"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ToneBadge } from "@workspace/console-ui/components/console/status-badge"
import { ErrorState } from "@workspace/console-ui/components/console/states"
import { timeAgo } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { getStorefrontUrl } from "@/lib/env"
import { getHomepage, mintHomepagePreview, publishHomepage, saveHomepageDraft, scheduleHomepage } from "@/lib/homepage"
import { labelOf, listCategories } from "@/lib/taxonomy"

export const Route = createFileRoute("/_app/homepage")({ component: HomepagePage })

type Draft = Record<string, unknown> & { id: string; type: HomeSectionType }

// ─── Section catalogue: names, what they're for, sensible defaults ─────────

const TYPES: { type: HomeSectionType; name: string; purpose: string; make: (id: string) => Draft }[] = [
  { type: "promo_hero", name: "Big banner", purpose: "The first thing buyers see — one message, one button.", make: (id) => ({ id, type: "promo_hero", title: "New season, new finds", theme: "gold", layout: "split", action: { label: "Shop now", href: "/categories" } }) },
  { type: "category_grid", name: "Category tiles", purpose: "Picture tiles into departments.", make: (id) => ({ id, type: "category_grid", title: "Shop by category", columns: 6, variant: "tiles", tiles: [] }) },
  { type: "product_shelf", name: "Product shelf", purpose: "A row of products — picked by you or by a rule like best sellers.", make: (id) => ({ id, type: "product_shelf", title: "Best sellers", source: "most_ordered", limit: 8, layout: "carousel" }) },
  { type: "deal_rail", name: "Deals rail", purpose: "Products with a badge and an optional countdown.", make: (id) => ({ id, type: "deal_rail", title: "Today's deals", badge: "Deal", source: "featured", limit: 8 }) },
  { type: "store_rail", name: "Shops rail", purpose: "Shops to discover — top rated, fastest, nearby…", make: (id) => ({ id, type: "store_rail", title: "Shops near you", source: "near_me", limit: 8, layout: "carousel" }) },
  { type: "promo_grid", name: "Promo cards", purpose: "2–4 cards, each linking somewhere.", make: (id) => ({ id, type: "promo_grid", columns: 3, theme: "white", variant: "cards", tiles: [{ id: `${id}-1`, title: "New in", href: "/search?sort=newest" }] }) },
  { type: "promo_band", name: "Promo strip", purpose: "A slim full-width message between shelves.", make: (id) => ({ id, type: "promo_band", title: "Free delivery this weekend", theme: "black" }) },
  { type: "countdown_banner", name: "Countdown", purpose: "A sale with a live timer.", make: (id) => ({ id, type: "countdown_banner", title: "Flash sale ends in", theme: "gold", countdownTo: new Date(Date.now() + 3 * 864e5).toISOString() }) },
  { type: "marquee", name: "Scrolling ticker", purpose: "Short lines that scroll across the page.", make: (id) => ({ id, type: "marquee", theme: "gold", animated: true, items: [{ id: `${id}-1`, label: "Pay on delivery everywhere" }] }) },
  { type: "value_grid", name: "Why shop here", purpose: "2–4 short promises (delivery, payment, returns).", make: (id) => ({ id, type: "value_grid", title: "Why alkemart", items: [{ id: `${id}-1`, title: "Pay on delivery", body: "Pay when it arrives." }, { id: `${id}-2`, title: "Real shops", body: "Every shop is checked." }] }) },
]
const nameOf = (t: HomeSectionType) => TYPES.find((x) => x.type === t)?.name ?? t

const THEME: [string, string][] = [["white", "Light"], ["gold", "Gold"], ["black", "Dark"]]
const PRODUCT_SOURCES: [string, string][] = [
  ["featured", "Featured picks"], ["latest", "Newest"], ["most_ordered", "Best sellers"], ["trending", "Trending this week"],
  ["top_rated", "Top rated by buyers"], ["category", "From one category"], ["manual", "Hand-picked products"], ["daypart", "Changes with the time of day"], ["near_me", "From shops near the buyer"],
]
const STORE_SOURCES: [string, string][] = [["top_rated", "Top rated"], ["fastest", "Fastest delivery"], ["newest", "Newest shops"], ["near_me", "Near the buyer"], ["manual", "Hand-picked shops"]]
const LIMITS: [string, string][] = [["4", "4"], ["8", "8"], ["12", "12"]]

type Field =
  | { k: "text"; key: string; label: string; max: number; hint?: string }
  | { k: "textarea"; key: string; label: string; max: number }
  | { k: "select"; key: string; label: string; options: [string, string][]; numeric?: boolean }
  | { k: "switch"; key: string; label: string }
  | { k: "datetime"; key: string; label: string; hint?: string }
  | { k: "link"; key: string; label: string }
  | { k: "category"; key: string; label: string }
  | { k: "list"; key: string; label: string; hint: string }
  | { k: "image"; key: string; label: string }
  | { k: "items"; key: string; label: string; shape: "tile" | "categoryTile" | "marquee" | "value" }
  | { k: "daypart" }

/** Which fields each type shows; `when` hides ones that don't apply. */
function fieldsFor(d: Draft): Field[] {
  const src = d.source as string | undefined
  switch (d.type) {
    case "promo_hero":
      return [{ k: "text", key: "eyebrow", label: "Small line above", max: 40 }, { k: "text", key: "title", label: "Headline", max: 100 }, { k: "text", key: "subtitle", label: "Subheading", max: 160 }, { k: "image", key: "imageUrl", label: "Image" }, { k: "link", key: "action", label: "Button" }, { k: "select", key: "theme", label: "Colour", options: THEME }, { k: "select", key: "layout", label: "Layout", options: [["split", "Text beside image"], ["band", "Full-width band"]] }]
    case "promo_band":
      return [{ k: "text", key: "eyebrow", label: "Small line above", max: 40 }, { k: "text", key: "title", label: "Message", max: 100 }, { k: "textarea", key: "body", label: "More detail", max: 240 }, { k: "image", key: "imageUrl", label: "Image" }, { k: "link", key: "action", label: "Button" }, { k: "link", key: "secondaryAction", label: "Second button" }, { k: "select", key: "theme", label: "Colour", options: THEME }]
    case "countdown_banner":
      return [{ k: "text", key: "eyebrow", label: "Small line above", max: 40 }, { k: "text", key: "title", label: "Headline", max: 100 }, { k: "datetime", key: "countdownTo", label: "Counts down to" }, { k: "text", key: "expiredLabel", label: "Shown when it ends", max: 60 }, { k: "link", key: "action", label: "Button" }, { k: "select", key: "theme", label: "Colour", options: THEME }]
    case "promo_grid":
      return [{ k: "text", key: "title", label: "Heading", max: 100 }, { k: "select", key: "columns", label: "Cards per row", options: [["2", "2"], ["3", "3"], ["4", "4"]], numeric: true }, { k: "select", key: "variant", label: "Style", options: [["cards", "Cards"], ["bento", "Mixed sizes"]] }, { k: "select", key: "theme", label: "Colour", options: THEME }, { k: "items", key: "tiles", label: "Cards", shape: "tile" }]
    case "category_grid":
      return [{ k: "text", key: "title", label: "Heading", max: 100 }, { k: "select", key: "variant", label: "Style", options: [["tiles", "Tiles"], ["mosaic", "Mosaic"], ["rail", "Scrolling row"], ["banner", "Banners"]] }, { k: "select", key: "columns", label: "Per row", options: [["4", "4"], ["6", "6"], ["8", "8"]], numeric: true }, { k: "switch", key: "showAllLink", label: "Show “See all” link" }, { k: "items", key: "tiles", label: "Categories", shape: "categoryTile" }]
    case "product_shelf":
    case "deal_rail":
      return [
        ...(d.type === "deal_rail" ? ([{ k: "text", key: "badge", label: "Badge on products", max: 20 }] as Field[]) : []),
        { k: "text", key: "title", label: "Heading", max: 100 },
        { k: "text", key: "subtitle", label: "Subheading", max: 160 },
        { k: "select", key: "source", label: "Which products", options: d.type === "deal_rail" ? PRODUCT_SOURCES.filter(([v]) => v !== "daypart") : PRODUCT_SOURCES },
        ...(src === "category" ? ([{ k: "category", key: "categoryId", label: "Category" }] as Field[]) : []),
        ...(src === "manual" ? ([{ k: "list", key: "productIds", label: "Product IDs", hint: "One per line, in the order to show them (max 12)." }] as Field[]) : []),
        ...(src === "daypart" ? ([{ k: "daypart" }] as Field[]) : []),
        { k: "select", key: "limit", label: "How many", options: LIMITS, numeric: true },
        ...(d.type === "deal_rail" ? ([{ k: "datetime", key: "countdownTo", label: "Countdown to (optional)" }] as Field[]) : ([{ k: "select", key: "layout", label: "Layout", options: [["carousel", "Scrolling row"], ["grid", "Grid"]] }] as Field[])),
      ]
    case "store_rail":
      return [{ k: "text", key: "title", label: "Heading", max: 100 }, { k: "text", key: "subtitle", label: "Subheading", max: 160 }, { k: "select", key: "source", label: "Which shops", options: STORE_SOURCES }, ...(src === "manual" ? ([{ k: "list", key: "sellerHandles", label: "Shop handles", hint: "One per line, e.g. accra-mart." }] as Field[]) : []), { k: "select", key: "limit", label: "How many", options: LIMITS, numeric: true }, { k: "select", key: "layout", label: "Layout", options: [["carousel", "Scrolling row"], ["grid", "Grid"]] }]
    case "marquee":
      return [{ k: "items", key: "items", label: "Lines", shape: "marquee" }, { k: "switch", key: "animated", label: "Scroll" }, { k: "select", key: "theme", label: "Colour", options: THEME }]
    case "value_grid":
      return [{ k: "text", key: "title", label: "Heading", max: 100 }, { k: "items", key: "items", label: "Promises", shape: "value" }]
  }
  return []
}

/** One line under each section so the list reads without opening anything. */
function summaryOf(d: Draft, cats: Map<string, string>) {
  const t = (d.title as string) || (d.type === "marquee" ? ((d.items as { label: string }[] | undefined)?.map((i) => i.label).join(" · ") ?? "") : "")
  const src = d.source ? (PRODUCT_SOURCES.concat(STORE_SOURCES).find(([v]) => v === d.source)?.[1] ?? String(d.source)) : null
  const cat = d.categoryId ? cats.get(d.categoryId as string) : null
  return [t, src, cat].filter(Boolean).join(" — ")
}

const uid = (type: string) => `${type}-${Math.random().toString(36).slice(2, 7)}`
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong.")

// ─── Page ────────────────────────────────────────────────────────────────

function HomepagePage() {
  const q = useQuery({ queryKey: ["homepage-doc"], queryFn: getHomepage })
  if (q.isPending) return <Skeleton className="h-[32rem] rounded-2xl" />
  if (q.isError) return <ErrorState title="The homepage didn't load" error={q.error} onRetry={() => void q.refetch()} />
  return <Editor key={q.data.revision} doc={q.data} />
}

function Editor({ doc }: { doc: HomepageDocument }) {
  const qc = useQueryClient()
  const [sections, setSections] = useState<Draft[]>(() => doc.sections as unknown as Draft[])
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [scheduleAt, setScheduleAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cats = useQuery({ queryKey: ["categories"], queryFn: listCategories, staleTime: 300_000 })
  const catNames = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, labelOf(c)])), [cats.data])
  const dirty = JSON.stringify(sections) !== JSON.stringify(doc.sections)

  // Leaving with unsaved work loses it — warn like any editor.
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [dirty])

  const onSaved = (d: HomepageDocument, msg: string) => {
    setError(null)
    qc.setQueryData(["homepage-doc"], d)
    toast.success(msg)
  }
  const onFail = (e: unknown) => {
    const status = (e as { status?: number }).status
    if (status === 409) {
      setError("Someone else changed the homepage while you were editing. Copy anything you need, then reload to get their version.")
    } else setError(errText(e))
  }
  const save = useMutation({ mutationFn: () => saveHomepageDraft(doc.revision, sections as unknown as HomeSection[]), onSuccess: (d) => onSaved(d, "Draft saved — buyers don't see it yet."), onError: onFail })
  const publish = useMutation({
    mutationFn: async () => {
      const d = dirty ? await saveHomepageDraft(doc.revision, sections as unknown as HomeSection[]) : doc
      return publishHomepage(d.revision)
    },
    onSuccess: (d) => onSaved(d, "Published — it's live now."),
    onError: onFail,
    onSettled: () => setConfirmPublish(false),
  })
  const schedule = useMutation({
    mutationFn: async () => {
      const d = dirty ? await saveHomepageDraft(doc.revision, sections as unknown as HomeSection[]) : doc
      return scheduleHomepage(d.revision, scheduleAt!)
    },
    onSuccess: (d) => onSaved(d, `Scheduled for ${new Date(scheduleAt!).toLocaleString()}.`),
    onError: onFail,
  })
  const preview = useMutation({
    mutationFn: async () => {
      if (dirty) await saveHomepageDraft(doc.revision, sections as unknown as HomeSection[]).then((d) => qc.setQueryData(["homepage-doc"], d))
      return mintHomepagePreview()
    },
    onSuccess: ({ token }) => window.open(`${getStorefrontUrl()}/?preview=${encodeURIComponent(token)}`, "_blank", "noopener"),
    onError: onFail,
  })

  const update = (id: string, patch: Record<string, unknown>) => setSections((xs) => xs.map((s) => (s.id === id ? ({ ...s, ...patch } as Draft) : s)))
  const move = (i: number, by: number) =>
    setSections((xs) => {
      const j = i + by
      if (j < 0 || j >= xs.length) return xs
      const next = [...xs]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  const busy = save.isPending || publish.isPending || schedule.isPending || preview.isPending
  const current = sections.find((s) => s.id === editing) ?? null

  return (
    <div className="space-y-5">
      <PageHeader title="Homepage" description="What buyers see first. Edit, preview on the real storefront, then publish or schedule." />
      <div className="sticky top-16 z-20 flex flex-col gap-3 rounded-2xl border bg-card/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <ToneBadge tone={doc.status === "published" ? "success" : doc.status === "scheduled" ? "brand" : "neutral"}>
            {doc.status === "published" ? "Live" : doc.status === "scheduled" ? "Scheduled" : "Not published yet"}
          </ToneBadge>
          {doc.status === "scheduled" && doc.publishAt ? <span>goes live {new Date(doc.publishAt).toLocaleString()}</span> : null}
          <span className="text-muted-foreground">saved {timeAgo(doc.updatedAt)}</span>
          {dirty ? <ToneBadge tone="warning">Unsaved changes</ToneBadge> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => preview.mutate()}>
            {preview.isPending ? <Spinner /> : <HugeiconsIcon icon={EyeIcon} data-icon="inline-start" />} Preview
          </Button>
          <Button variant="outline" disabled={!dirty || busy} onClick={() => save.mutate()}>
            {save.isPending ? <Spinner /> : null} Save draft
          </Button>
          <Button variant="brand" disabled={busy} onClick={() => setConfirmPublish(true)}>
            Publish
          </Button>
        </div>
      </div>
      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-danger-soft p-4 text-sm text-destructive">
          <span>{error}</span>
          {error.startsWith("Someone else") ? (
            <Button size="sm" variant="outline" onClick={() => void qc.invalidateQueries({ queryKey: ["homepage-doc"] })}>
              Reload
            </Button>
          ) : null}
        </div>
      ) : null}

      <ol className="space-y-2">
        {sections.map((s, i) => {
          const hidden = s.visible === false
          const windowed = s.startsAt || s.endsAt
          return (
            <li key={s.id} className={cn("flex items-center gap-2 rounded-2xl border bg-card p-3", hidden && "opacity-60")}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold tabular" aria-hidden>
                {i + 1}
              </span>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(s.id)}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{nameOf(s.type)}</span>
                  {hidden ? <ToneBadge tone="neutral">Hidden</ToneBadge> : null}
                  {windowed ? <ToneBadge tone="info">Timed</ToneBadge> : null}
                </span>
                <span className="block truncate text-sm text-muted-foreground">{summaryOf(s, catNames) || "—"}</span>
              </button>
              <Switch aria-label={`Show ${nameOf(s.type)} ${i + 1}`} checked={!hidden} onCheckedChange={(v) => update(s.id, { visible: v ? undefined : false })} />
              <Button variant="ghost" size="icon-sm" aria-label={`Move section ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <HugeiconsIcon icon={ArrowUp01Icon} />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Move section ${i + 1} down`} disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
                <HugeiconsIcon icon={ArrowDown01Icon} />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Edit section ${i + 1}`} onClick={() => setEditing(s.id)}>
                <HugeiconsIcon icon={PencilEdit01Icon} />
              </Button>
            </li>
          )
        })}
      </ol>
      <Button variant="outline" size="lg" onClick={() => setAdding(true)} disabled={sections.length >= 24}>
        <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" /> Add a section
      </Button>

      <section aria-labelledby="sched" className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="sched-at" id="sched">
            Or publish later
          </Label>
          <DateTimePicker id="sched-at" value={scheduleAt} onChange={setScheduleAt} min={new Date()} placeholder="Pick when it goes live" className="w-72" />
        </div>
        <Button variant="outline" disabled={!scheduleAt || busy} onClick={() => schedule.mutate()}>
          {schedule.isPending ? <Spinner /> : null} Schedule
        </Button>
      </section>

      <Sheet open={current !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {current ? (
            <SectionEditor
              d={current}
              cats={(cats.data ?? []).filter((c) => c.status === "active").map((c) => [c.id, labelOf(c)] as [string, string])}
              onChange={(patch) => update(current.id, patch)}
              onDuplicate={() => {
                const copy = { ...structuredClone(current), id: uid(current.type) } as Draft
                setSections((xs) => {
                  const i = xs.findIndex((x) => x.id === current.id)
                  return [...xs.slice(0, i + 1), copy, ...xs.slice(i + 1)]
                })
                setEditing(copy.id)
              }}
              onDelete={() => {
                setSections((xs) => xs.filter((x) => x.id !== current.id))
                setEditing(null)
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-left">Add a section</SheetTitle>
            <SheetDescription className="text-left">It's added at the end — move it where you want.</SheetDescription>
          </SheetHeader>
          <ul className="space-y-2 px-4 pb-8">
            {TYPES.map((t) => (
              <li key={t.type}>
                <button
                  type="button"
                  className="w-full rounded-2xl border p-3 text-left hover:bg-muted"
                  onClick={() => {
                    const d = t.make(uid(t.type))
                    setSections((xs) => [...xs, d])
                    setAdding(false)
                    setEditing(d.id)
                  }}
                >
                  <span className="block font-semibold">{t.name}</span>
                  <span className="block text-sm text-muted-foreground">{t.purpose}</span>
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmPublish} onOpenChange={(o) => !o && !publish.isPending && setConfirmPublish(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish the homepage now?</AlertDialogTitle>
            <AlertDialogDescription>Every buyer sees this version within a minute. Tip: use Preview first to check it on a phone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publish.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={publish.isPending}
              onClick={(e) => {
                e.preventDefault()
                publish.mutate()
              }}
            >
              {publish.isPending ? <Spinner /> : null} Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Section editor ─────────────────────────────────────────────────────

function SectionEditor({ d, cats, onChange, onDuplicate, onDelete }: { d: Draft; cats: [string, string][]; onChange: (p: Record<string, unknown>) => void; onDuplicate: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (key: string, value: unknown) => onChange({ [key]: value === "" ? undefined : value })
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-left">{nameOf(d.type)}</SheetTitle>
        <SheetDescription className="text-left">{TYPES.find((t) => t.type === d.type)?.purpose}</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-8">
        {fieldsFor(d).map((f, i) => (
          <FieldInput key={("key" in f ? f.key : "daypart") + i} f={f} d={d} cats={cats} set={set} />
        ))}
        <fieldset className="space-y-2 rounded-2xl border p-3">
          <legend className="px-1 text-sm font-medium">Only show between (optional)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="starts">From</Label>
              <DateTimePicker id="starts" value={d.startsAt as string | null} onChange={(v) => set("startsAt", v)} placeholder="Straight away" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ends">Until</Label>
              <DateTimePicker id="ends" value={d.endsAt as string | null} onChange={(v) => set("endsAt", v)} placeholder="No end" min={d.startsAt ? new Date(d.startsAt as string) : undefined} />
            </div>
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" onClick={onDuplicate}>
            <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" /> Duplicate
          </Button>
          {confirmDelete ? (
            <>
              <Button variant="destructive" onClick={onDelete}>
                Remove section
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Changes stay in this editor until you save or publish.</p>
      </div>
    </>
  )
}

function Select({ id, value, options, onChange, placeholder }: { id: string; value: string; options: [string, string][]; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-4xl border bg-input/30 px-3 text-sm">
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}

function FieldInput({ f, d, cats, set }: { f: Field; d: Draft; cats: [string, string][]; set: (k: string, v: unknown) => void }) {
  if (f.k === "daypart") {
    const parts = (d.daypartCategoryIds as Record<string, string> | undefined) ?? {}
    return (
      <fieldset className="space-y-2 rounded-2xl border p-3">
        <legend className="px-1 text-sm font-medium">Category for each part of the day</legend>
        {(["breakfast", "lunch", "supper", "late"] as const).map((p) => (
          <div key={p} className="grid grid-cols-[6rem_1fr] items-center gap-2">
            <Label htmlFor={`dp-${p}`} className="capitalize">
              {p}
            </Label>
            <Select id={`dp-${p}`} value={parts[p] ?? ""} options={cats} placeholder="Nothing" onChange={(v) => set("daypartCategoryIds", { ...parts, [p]: v || undefined })} />
          </div>
        ))}
      </fieldset>
    )
  }
  const id = `f-${f.key}`
  const v = d[f.key]
  switch (f.k) {
    case "text":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <Input id={id} maxLength={f.max} value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} />
        </div>
      )
    case "textarea":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <Textarea id={id} rows={2} maxLength={f.max} value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} />
        </div>
      )
    case "image":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{f.label} (https:// or /path)</Label>
          <Input id={id} value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder="https://…" />
          {typeof v === "string" && v ? <img src={v} alt="" className="h-24 rounded-xl object-cover" /> : null}
        </div>
      )
    case "select":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <Select id={id} value={v == null ? "" : String(v)} options={f.options} onChange={(x) => set(f.key, f.numeric ? Number(x) : x)} />
        </div>
      )
    case "switch":
      return (
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          {f.label}
          <Switch checked={Boolean(v)} onCheckedChange={(x) => set(f.key, x)} />
        </label>
      )
    case "datetime":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <DateTimePicker id={id} value={v as string | null} onChange={(x) => set(f.key, x)} min={new Date()} />
        </div>
      )
    case "category":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <Select id={id} value={(v as string) ?? ""} options={cats} placeholder="Choose a category" onChange={(x) => set(f.key, x)} />
        </div>
      )
    case "list":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <Textarea id={id} rows={4} value={((v as string[]) ?? []).join("\n")} onChange={(e) => set(f.key, e.target.value.split(/[\n,]/).map((x) => x.trim()).filter(Boolean).slice(0, 12))} className="font-mono text-sm" />
          <p className="text-xs text-muted-foreground">{f.hint}</p>
        </div>
      )
    case "link": {
      const l = (v as { label?: string; href?: string } | undefined) ?? {}
      const put = (p: { label?: string; href?: string }) => {
        const next = { ...l, ...p }
        set(f.key, next.label || next.href ? next : undefined)
      }
      return (
        <fieldset className="space-y-2 rounded-2xl border p-3">
          <legend className="px-1 text-sm font-medium">{f.label} (optional)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input aria-label={`${f.label} text`} placeholder="Text, e.g. Shop now" maxLength={40} value={l.label ?? ""} onChange={(e) => put({ label: e.target.value })} />
            <Input aria-label={`${f.label} link`} placeholder="/categories/phones" value={l.href ?? ""} onChange={(e) => put({ href: e.target.value })} />
          </div>
          {l.href && !l.href.startsWith("/") ? <p className="text-xs text-destructive">Links must start with / (pages on alkemart).</p> : null}
        </fieldset>
      )
    }
    case "items":
      return <ItemsEditor f={f} items={(v as Record<string, unknown>[]) ?? []} cats={cats} onChange={(xs) => set(f.key, xs)} />
  }
}

function ItemsEditor({ f, items, cats, onChange }: { f: Extract<Field, { k: "items" }>; items: Record<string, unknown>[]; cats: [string, string][]; onChange: (xs: Record<string, unknown>[]) => void }) {
  const max = f.shape === "categoryTile" ? 16 : f.shape === "value" ? 4 : 8
  const patch = (i: number, p: Record<string, unknown>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const blank = (): Record<string, unknown> =>
    f.shape === "categoryTile" ? { categoryId: cats[0]?.[0] ?? "" } : f.shape === "tile" ? { id: uid("tile"), title: "New card", href: "/" } : f.shape === "marquee" ? { id: uid("line"), label: "New line" } : { id: uid("value"), title: "Promise", body: "One short sentence." }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {f.label} <span className="font-normal text-muted-foreground">({items.length}/{max})</span>
      </legend>
      {f.shape === "categoryTile" && items.length === 0 ? <p className="text-xs text-muted-foreground">Empty shows every department automatically. Add categories to choose them and their order.</p> : null}
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li key={(it.id as string) ?? (it.categoryId as string) + i} className="space-y-2 rounded-xl border p-3">
            {f.shape === "categoryTile" ? (
              <>
                <Select id={`ct-${i}`} value={(it.categoryId as string) ?? ""} options={cats} onChange={(v) => patch(i, { categoryId: v })} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input aria-label="Label override" placeholder="Label (optional)" maxLength={60} value={(it.label as string) ?? ""} onChange={(e) => patch(i, { label: e.target.value || undefined })} />
                  <Input aria-label="Badge" placeholder="Badge, e.g. New" maxLength={20} value={(it.badge as string) ?? ""} onChange={(e) => patch(i, { badge: e.target.value || undefined })} />
                  <Input aria-label="Image URL" placeholder="Image https://… (optional)" className="sm:col-span-2" value={(it.imageUrl as string) ?? ""} onChange={(e) => patch(i, { imageUrl: e.target.value || undefined })} />
                </div>
              </>
            ) : f.shape === "marquee" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input aria-label="Line text" maxLength={80} value={(it.label as string) ?? ""} onChange={(e) => patch(i, { label: e.target.value })} />
                <Input aria-label="Line link" placeholder="/link (optional)" value={(it.href as string) ?? ""} onChange={(e) => patch(i, { href: e.target.value || undefined })} />
              </div>
            ) : f.shape === "value" ? (
              <>
                <Input aria-label="Promise title" maxLength={80} value={(it.title as string) ?? ""} onChange={(e) => patch(i, { title: e.target.value })} />
                <Input aria-label="Promise text" maxLength={180} value={(it.body as string) ?? ""} onChange={(e) => patch(i, { body: e.target.value })} />
              </>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input aria-label="Card title" maxLength={80} value={(it.title as string) ?? ""} onChange={(e) => patch(i, { title: e.target.value })} />
                <Input aria-label="Card link" placeholder="/categories/…" value={(it.href as string) ?? ""} onChange={(e) => patch(i, { href: e.target.value })} />
                <Input aria-label="Card small line" placeholder="Small line (optional)" maxLength={40} value={(it.eyebrow as string) ?? ""} onChange={(e) => patch(i, { eyebrow: e.target.value || undefined })} />
                <Input aria-label="Card image" placeholder="Image https://… (optional)" value={(it.imageUrl as string) ?? ""} onChange={(e) => patch(i, { imageUrl: e.target.value || undefined })} />
              </div>
            )}
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => onChange(items.map((x, j) => (j === i - 1 ? items[i]! : j === i ? items[i - 1]! : x)))}>
                Up
              </Button>
              <Button variant="ghost" size="sm" disabled={i === items.length - 1} onClick={() => onChange(items.map((x, j) => (j === i + 1 ? items[i]! : j === i ? items[i + 1]! : x)))}>
                Down
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Button variant="outline" size="sm" disabled={items.length >= max} onClick={() => onChange([...items, blank()])}>
        <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" /> Add
      </Button>
    </fieldset>
  )
}
