import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, ArrowRight01Icon, BookOpen01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Checkbox } from "@workspace/console-ui/components/checkbox"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Textarea } from "@workspace/console-ui/components/textarea"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/console-ui/components/sheet"
import { DatePicker } from "@workspace/console-ui/components/console/date-time-picker"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ToneBadge } from "@workspace/console-ui/components/console/status-badge"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { timeAgo } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { getStorefrontUrl } from "@/lib/env"
import { createGuide, deleteGuide, listGuides, publishGuide, unpublishGuide, updateGuide, type Guide, type GuideSection } from "@/lib/guides"
import { listCategories } from "@/lib/taxonomy"

type Tab = "published" | "draft" | "refresh"
const TABS: { id: Tab; label: string }[] = [
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
  { id: "refresh", label: "Needs a refresh" },
]

export const Route = createFileRoute("/_app/guides")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: TABS.some((t) => t.id === s.tab) ? (s.tab as Tab) : undefined }),
  component: GuidesPage,
})

const stale = (g: Guide) => g.status === "published" && !!g.refreshAfter && new Date(g.refreshAfter) < new Date()
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong.")
const slugFrom = (t: string) => t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)

function GuidesPage() {
  const search = Route.useSearch()
  const q = useQuery({ queryKey: ["guides"], queryFn: listGuides, staleTime: 20_000 })
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const all = q.data ?? []
  const tab = search.tab ?? (all.some(stale) ? "refresh" : "published")
  const rows = all.filter((g) => (tab === "refresh" ? stale(g) : g.status === tab))
  return (
    <div className="space-y-6">
      <PageHeader
        title="Guides"
        description="Buying guides that help people choose — and link straight to the right products."
        actions={
          <Button onClick={() => setCreating(true)}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" /> New guide
          </Button>
        }
      />
      <nav aria-label="Guide lists" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.id
          const n = all.filter((g) => (t.id === "refresh" ? stale(g) : g.status === t.id)).length
          return (
            <Link
              key={t.id}
              to="/guides"
              search={{ tab: t.id }}
              replace
              aria-current={active ? "page" : undefined}
              className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}
            >
              {t.label} <span className="tabular opacity-70">{n}</span>
            </Link>
          )
        })}
      </nav>
      {q.isPending ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Guides didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : rows.length === 0 ? (
        <EmptyState icon={BookOpen01Icon} title={tab === "refresh" ? "Every guide is up to date" : "No guides here"} className="rounded-2xl border bg-card" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {rows.map((g) => (
            <li key={g.slug}>
              <button type="button" onClick={() => setOpen(g.slug)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/60">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{g.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {g.author} · {g.sections.length} section{g.sections.length === 1 ? "" : "s"} · updated {timeAgo(g.updatedAt)}
                  </span>
                </span>
                {stale(g) ? <ToneBadge tone="warning">Refresh due</ToneBadge> : null}
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {open ? <GuideEditor key={open} guide={all.find((g) => g.slug === open)!} others={all.filter((g) => g.slug !== open)} onGone={() => setOpen(null)} /> : null}
        </SheetContent>
      </Sheet>
      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {creating ? (
            <CreateGuide
              onDone={(slug) => {
                setCreating(false)
                setOpen(slug)
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function CreateGuide({ onDone }: { onDone: (slug: string) => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [author, setAuthor] = useState("alkemart team")
  const create = useMutation({
    mutationFn: () => createGuide({ slug: slugFrom(title), title: title.trim(), excerpt: excerpt.trim(), author: author.trim() }),
    onSuccess: async (g) => {
      await qc.invalidateQueries({ queryKey: ["guides"] })
      onDone(g.slug)
    },
    onError: (e) => toast.error(errText(e)),
  })
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-left">New guide</SheetTitle>
        <SheetDescription className="text-left">Starts as a private draft.</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-8">
        <div className="space-y-1.5">
          <Label htmlFor="g-title">Title</Label>
          <Input id="g-title" maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How to choose a phone under GH₵2,000" />
          {title ? <p className="text-xs text-muted-foreground">Link: /guides/{slugFrom(title)}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-excerpt">One-line summary</Label>
          <Textarea id="g-excerpt" rows={2} maxLength={300} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-author">Author</Label>
          <Input id="g-author" maxLength={120} value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>
        <Button disabled={!slugFrom(title) || !excerpt.trim() || !author.trim() || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Spinner /> : null} Create draft
        </Button>
      </div>
    </>
  )
}

function GuideEditor({ guide, others, onGone }: { guide: Guide; others: Guide[]; onGone: () => void }) {
  const qc = useQueryClient()
  const cats = useQuery({ queryKey: ["categories"], queryFn: listCategories, staleTime: 300_000 })
  const [title, setTitle] = useState(guide.title)
  const [excerpt, setExcerpt] = useState(guide.excerpt)
  const [author, setAuthor] = useState(guide.author)
  const [sections, setSections] = useState<GuideSection[]>(guide.sections)
  const [related, setRelated] = useState<string[]>(guide.relatedGuides)
  const [refresh, setRefresh] = useState<string | null>(guide.refreshAfter ? guide.refreshAfter.slice(0, 10) : null)
  const dirty =
    title !== guide.title ||
    excerpt !== guide.excerpt ||
    author !== guide.author ||
    JSON.stringify(sections) !== JSON.stringify(guide.sections) ||
    JSON.stringify(related) !== JSON.stringify(guide.relatedGuides) ||
    refresh !== (guide.refreshAfter ? guide.refreshAfter.slice(0, 10) : null)
  const refreshList = () => void qc.invalidateQueries({ queryKey: ["guides"] })
  const save = useMutation({
    mutationFn: () =>
      updateGuide(guide.slug, {
        title: title.trim(),
        excerpt: excerpt.trim(),
        author: author.trim(),
        sections: sections.map((s) => ({ ...s, picks: s.picks.filter((p) => p.categoryHandle || p.query) })),
        relatedGuides: related,
        refreshAfter: refresh ? new Date(`${refresh}T09:00`).toISOString() : null,
      }),
    onSuccess: () => {
      refreshList()
      toast.success("Saved")
    },
    onError: (e) => toast.error(errText(e)),
  })
  const status = useMutation({
    mutationFn: async () => {
      if (dirty) await save.mutateAsync()
      return guide.status === "published" ? unpublishGuide(guide.slug) : publishGuide(guide.slug)
    },
    onSuccess: (g) => {
      refreshList()
      toast.success(g.status === "published" ? "Published — it's on the site." : "Unpublished.")
    },
    onError: (e) => toast.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: () => deleteGuide(guide.slug),
    onSuccess: () => {
      refreshList()
      onGone()
      toast.success("Draft deleted.")
    },
    onError: (e) => toast.error(errText(e)),
  })
  const patchSection = (i: number, p: Partial<GuideSection>) => setSections((xs) => xs.map((s, j) => (j === i ? { ...s, ...p } : s)))
  const catOptions = (cats.data ?? []).filter((c) => c.status === "active")
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex flex-wrap items-center gap-2 text-left">
          {guide.title} <ToneBadge tone={guide.status === "published" ? "success" : "neutral"}>{guide.status === "published" ? "Published" : "Draft"}</ToneBadge>
        </SheetTitle>
        <SheetDescription className="text-left">/guides/{guide.slug}</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-8">
        <div className="sticky top-0 z-10 flex flex-wrap gap-2 bg-background py-2">
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Spinner /> : null} Save
          </Button>
          <Button variant={guide.status === "published" ? "outline" : "brand"} disabled={status.isPending || (guide.status === "draft" && sections.length === 0)} onClick={() => status.mutate()}>
            {guide.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          {guide.status === "published" ? (
            <Button asChild variant="ghost">
              <a href={`${getStorefrontUrl()}/guides/${guide.slug}`} target="_blank" rel="noopener noreferrer">
                <HugeiconsIcon icon={LinkSquare02Icon} data-icon="inline-start" /> View
              </a>
            </Button>
          ) : null}
        </div>
        {guide.status === "draft" && sections.length === 0 ? <p className="text-sm text-muted-foreground">Add at least one section to publish.</p> : null}
        <div className="space-y-1.5">
          <Label htmlFor="e-title">Title</Label>
          <Input id="e-title" maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-excerpt">One-line summary</Label>
          <Textarea id="e-excerpt" rows={2} maxLength={300} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="e-author">Author</Label>
            <Input id="e-author" maxLength={120} value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-refresh">Check it again on</Label>
            <DatePicker id="e-refresh" value={refresh} onChange={setRefresh} min={new Date()} placeholder="No reminder" />
          </div>
        </div>

        <section aria-labelledby="sections" className="space-y-3">
          <h3 id="sections" className="font-semibold">
            Sections
          </h3>
          {sections.map((s, i) => (
            <div key={i} className="space-y-2 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Section {i + 1}</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => setSections((xs) => xs.map((x, j) => (j === i - 1 ? xs[i]! : j === i ? xs[i - 1]! : x)))}>
                    Up
                  </Button>
                  <Button size="sm" variant="ghost" disabled={i === sections.length - 1} onClick={() => setSections((xs) => xs.map((x, j) => (j === i + 1 ? xs[i]! : j === i ? xs[i + 1]! : x)))}>
                    Down
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSections((xs) => xs.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </span>
              </div>
              <Input aria-label={`Section ${i + 1} heading`} maxLength={140} placeholder="Heading" value={s.heading} onChange={(e) => patchSection(i, { heading: e.target.value })} />
              <Textarea aria-label={`Section ${i + 1} text`} rows={6} maxLength={5000} placeholder="Write plainly — what to look for, what to avoid." value={s.body} onChange={(e) => patchSection(i, { body: e.target.value })} />
              <div className="space-y-2">
                <p className="text-sm font-medium">Show products under this section (up to 3 rows)</p>
                {s.picks.map((p, k) => (
                  <div key={k} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <select
                      aria-label="From category"
                      value={p.categoryHandle ?? ""}
                      onChange={(e) => patchSection(i, { picks: s.picks.map((x, m) => (m === k ? { ...x, categoryHandle: e.target.value || null } : x)) })}
                      className="h-10 rounded-4xl border bg-input/30 px-3 text-sm"
                    >
                      <option value="">Any category</option>
                      {catOptions.map((c) => (
                        <option key={c.id} value={c.handle}>
                          {c.displayName || c.canonicalName}
                        </option>
                      ))}
                    </select>
                    <Input aria-label="Matching words" placeholder="Matching words, e.g. 128GB" value={p.query ?? ""} onChange={(e) => patchSection(i, { picks: s.picks.map((x, m) => (m === k ? { ...x, query: e.target.value || null } : x)) })} />
                    <Button size="sm" variant="ghost" onClick={() => patchSection(i, { picks: s.picks.filter((_, m) => m !== k) })}>
                      Remove
                    </Button>
                  </div>
                ))}
                {s.picks.length < 3 ? (
                  <Button size="sm" variant="outline" onClick={() => patchSection(i, { picks: [...s.picks, { limit: 4 }] })}>
                    Add product row
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          <Button variant="outline" disabled={sections.length >= 20} onClick={() => setSections((xs) => [...xs, { heading: "", body: "", picks: [] }])}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" /> Add section
          </Button>
        </section>

        {others.length ? (
          <fieldset className="space-y-2">
            <legend className="font-semibold">Related guides</legend>
            {others.map((o) => (
              <label key={o.slug} className="flex items-center gap-2.5 text-sm">
                <Checkbox checked={related.includes(o.slug)} onCheckedChange={(v) => setRelated((xs) => (v ? [...xs, o.slug].slice(0, 8) : xs.filter((x) => x !== o.slug)))} />
                {o.title}
              </label>
            ))}
          </fieldset>
        ) : null}

        {guide.status === "draft" ? (
          <Button variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Delete draft
          </Button>
        ) : null}
      </div>
    </>
  )
}
