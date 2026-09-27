import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, ArrowDown01Icon, ArrowRight01Icon, Idea01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Switch } from "@workspace/console-ui/components/switch"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/console-ui/components/sheet"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ToneBadge } from "@workspace/console-ui/components/console/status-badge"
import { ErrorState } from "@workspace/console-ui/components/console/states"
import type { Tone } from "@workspace/console-ui/lib/status"
import { cn } from "@workspace/console-ui/lib/utils"
import { createCategory, labelOf, listCategories, listSuggestions, retireCategory, updateCategory, type CategoryNode, type CategoryPatch } from "@/lib/taxonomy"

export const Route = createFileRoute("/_app/categories")({ component: CategoriesPage })

const STATUS: Record<CategoryNode["status"], { label: string; tone: Tone }> = {
  active: { label: "Live", tone: "success" },
  proposed: { label: "Proposed", tone: "info" },
  deprecated: { label: "Retired", tone: "neutral" },
}

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong.")
const codeFrom = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80)

function CategoriesPage() {
  const q = useQuery({ queryKey: ["categories"], queryFn: listCategories, staleTime: 60_000 })
  const [term, setTerm] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(null)
  const [showRetired, setShowRetired] = useState(false)
  const nodes = useMemo(() => q.data ?? [], [q.data])
  const children = useMemo(() => {
    const m = new Map<string | null, CategoryNode[]>()
    for (const n of nodes) {
      if (!showRetired && n.status === "deprecated") continue
      const k = n.parentId
      m.set(k, [...(m.get(k) ?? []), n])
    }
    for (const list of m.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || labelOf(a).localeCompare(labelOf(b)))
    return m
  }, [nodes, showRetired])
  const needle = term.trim().toLowerCase()
  const matches = needle ? nodes.filter((n) => labelOf(n).toLowerCase().includes(needle) || n.handle.includes(needle)) : null
  const open = nodes.find((n) => n.id === openId) ?? null
  const counts = { live: nodes.filter((n) => n.status === "active").length, proposed: nodes.filter((n) => n.status === "proposed").length }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="The tree buyers browse and sellers file products into. Rename, hide from the menu, or retire with a replacement — nothing is deleted."
        actions={
          <Button onClick={() => setAdding({ parentId: null })}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" /> New top-level category
          </Button>
        }
      />
      <Suggestions nodes={nodes} onOpen={setOpenId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {counts.live} live · {counts.proposed} proposed
        </p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showRetired} onCheckedChange={setShowRetired} /> Show retired
          </label>
          <div className="relative w-60">
            <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Find a category" placeholder="Find a category" className="pl-9" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
        </div>
      </div>
      {q.isPending ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Categories didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : matches ? (
        <ul className="divide-y rounded-2xl border bg-card">
          {matches.length === 0 ? <li className="p-4 text-sm text-muted-foreground">No category matches “{term}”.</li> : null}
          {matches.map((n) => (
            <li key={n.id}>
              <Row n={n} path={pathOf(n, nodes)} onOpen={() => setOpenId(n.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <ul aria-label="Category tree" className="divide-y rounded-2xl border bg-card px-2 [&>li]:py-1">
          {(children.get(null) ?? []).map((n) => (
            <Branch key={n.id} n={n} kids={children} onOpen={setOpenId} onAdd={(parentId) => setAdding({ parentId })} depth={0} />
          ))}
        </ul>
      )}
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">{open ? <NodePanel key={open.id} n={open} nodes={nodes} /> : null}</SheetContent>
      </Sheet>
      <Sheet open={adding !== null} onOpenChange={(o) => !o && setAdding(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {adding ? <AddPanel parent={nodes.find((n) => n.id === adding.parentId) ?? null} onDone={() => setAdding(null)} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function pathOf(n: CategoryNode, nodes: CategoryNode[]) {
  const out: string[] = []
  let cur: CategoryNode | undefined = n
  while (cur) {
    out.unshift(labelOf(cur))
    cur = nodes.find((m) => m.id === cur!.parentId)
  }
  return out.join(" › ")
}

function Flags({ n }: { n: CategoryNode }) {
  return (
    <span className="flex flex-wrap gap-1">
      {/* "Live" is the normal state — only exceptions get a badge. */}
      {n.status !== "active" ? <ToneBadge tone={STATUS[n.status].tone}>{STATUS[n.status].label}</ToneBadge> : null}
      {n.status === "active" && !n.isNavVisible ? <ToneBadge tone="neutral">Hidden from menu</ToneBadge> : null}
      {n.status === "active" && !n.isAssignable ? <ToneBadge tone="neutral">Sellers can't pick</ToneBadge> : null}
    </span>
  )
}

function Row({ n, path, onOpen, top, count }: { n: CategoryNode; path?: string; onOpen: () => void; top?: boolean; count?: number }) {
  return (
    <button type="button" onClick={onOpen} className={cn("flex w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-muted", top ? "py-3" : "py-2")}>
      <span className="min-w-0 flex-1">
        <span className={cn("block", top ? "text-base font-bold" : "text-sm", n.status === "deprecated" && "text-muted-foreground line-through")}>
          {labelOf(n)}
          {count ? <span className="ml-2 text-xs font-normal text-muted-foreground tabular">{count} sub-categor{count === 1 ? "y" : "ies"}</span> : null}
        </span>
        {path ? <span className="block truncate text-xs text-muted-foreground">{path}</span> : null}
      </span>
      <Flags n={n} />
    </button>
  )
}

function Branch({ n, kids, onOpen, onAdd, depth }: { n: CategoryNode; kids: Map<string | null, CategoryNode[]>; onOpen: (id: string) => void; onAdd: (parentId: string) => void; depth: number }) {
  const [expanded, setExpanded] = useState(false)
  const mine = kids.get(n.id) ?? []
  return (
    <li>
      <div className="group flex items-center gap-1">
        {mine.length ? (
          <Button variant="ghost" size="icon-sm" aria-expanded={expanded} aria-label={`${labelOf(n)} sub-categories`} onClick={() => setExpanded((e) => !e)}>
            <HugeiconsIcon icon={expanded ? ArrowDown01Icon : ArrowRight01Icon} />
          </Button>
        ) : (
          <span className="w-8" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <Row n={n} onOpen={() => onOpen(n.id)} top={depth === 0} count={depth === 0 ? mine.length : undefined} />
        </div>
        {n.status !== "deprecated" ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Add a sub-category under ${labelOf(n)}`} className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => onAdd(n.id)}>
            <HugeiconsIcon icon={Add01Icon} />
          </Button>
        ) : null}
      </div>
      {expanded && mine.length ? (
        <ul className="mb-2 ml-[1.1rem] border-l-2 border-border pl-3">
          {mine.map((k) => (
            <Branch key={k.id} n={k} kids={kids} onOpen={onOpen} onAdd={onAdd} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function Suggestions({ nodes, onOpen }: { nodes: CategoryNode[]; onOpen: (id: string) => void }) {
  const q = useQuery({ queryKey: ["category-suggestions"], queryFn: listSuggestions, staleTime: 300_000 })
  const items = (q.data ?? []).filter((s) => s.kind !== "failed_match").slice(0, 6)
  if (!items.length) return null
  return (
    <section aria-labelledby="sugg" className="space-y-2 rounded-2xl bg-info-soft p-4">
      <h2 id="sugg" className="flex items-center gap-2 font-bold text-info">
        <HugeiconsIcon icon={Idea01Icon} className="size-5" aria-hidden /> Worth a look
      </h2>
      <ul className="space-y-1 text-sm">
        {items.map((s) => {
          const node = nodes.find((n) => n.id === s.ref)
          return (
            <li key={s.kind + s.ref}>
              {node ? (
                <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => onOpen(node.id)}>
                  <strong>{labelOf(node)}</strong>: {s.kind === "thin_category" ? `only ${s.count} product${s.count === 1 ? "" : "s"} — merge it or find sellers` : `${s.count} products filed under Other — give them proper homes`}
                </button>
              ) : (
                s.reason
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function NodePanel({ n, nodes }: { n: CategoryNode; nodes: CategoryNode[] }) {
  const qc = useQueryClient()
  const [name, setName] = useState(labelOf(n))
  const [replacement, setReplacement] = useState("")
  const [retiring, setRetiring] = useState(false)
  const refresh = () => void qc.invalidateQueries({ queryKey: ["categories"] })
  const patch = useMutation({
    mutationFn: (p: CategoryPatch) => updateCategory(n.id, p),
    onSuccess: () => {
      refresh()
      toast.success("Saved")
    },
    onError: (e) => toast.error(errText(e)),
  })
  const retire = useMutation({
    mutationFn: () => retireCategory(n.id, replacement),
    onSuccess: () => {
      refresh()
      setRetiring(false)
      toast.success("Retired. The replacement is recorded.")
    },
    onError: (e) => toast.error(errText(e)),
  })
  const kids = nodes.filter((m) => m.parentId === n.id && m.status !== "deprecated")
  const candidates = nodes.filter((m) => m.id !== n.id && m.status === "active" && m.isAssignable).sort((a, b) => labelOf(a).localeCompare(labelOf(b)))
  const toggles: { key: "isNavVisible" | "isAssignable" | "isBrowseable"; label: string; hint: string }[] = [
    { key: "isNavVisible", label: "Show in the menu", hint: "Buyers see it in the category menu and on Home." },
    { key: "isAssignable", label: "Sellers can file products here", hint: "Turn off for parent groupings that should only hold sub-categories." },
    { key: "isBrowseable", label: "Has its own page", hint: "Buyers can open /categories/…" },
  ]
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-left">{labelOf(n)}</SheetTitle>
        <SheetDescription className="text-left">{pathOf(n, nodes)}</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-8">
        <Flags n={n} />
        {n.status === "proposed" ? (
          <div className="space-y-2 rounded-2xl bg-info-soft p-4 text-sm">
            <p>Proposed categories aren't visible to buyers or sellers yet.</p>
            <Button disabled={patch.isPending} onClick={() => patch.mutate({ status: "active" })}>
              Make it live
            </Button>
          </div>
        ) : null}
        {n.status === "deprecated" ? (
          <p className="rounded-xl bg-muted p-3 text-sm">Retired — replaced by {labelOf(nodes.find((m) => m.id === n.replacementNodeId) ?? { displayName: null, canonicalName: "another category" })}.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name buyers see</Label>
              <div className="flex gap-2">
                <Input id="cat-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
                <Button disabled={!name.trim() || name.trim() === labelOf(n) || patch.isPending} onClick={() => patch.mutate({ displayName: name.trim() })}>
                  Rename
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Links stay the same ({n.slug ?? n.handle}).</p>
            </div>
            <ul className="divide-y rounded-2xl border">
              {toggles.map((t) => (
                <li key={t.key} className="flex items-center justify-between gap-4 p-3">
                  <label htmlFor={`t-${t.key}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-sm font-semibold">{t.label}</span>
                    <span className="block text-xs text-muted-foreground">{t.hint}</span>
                  </label>
                  <Switch id={`t-${t.key}`} checked={n[t.key]} disabled={patch.isPending} onCheckedChange={(v) => patch.mutate({ [t.key]: v })} />
                </li>
              ))}
            </ul>
            {kids.length ? (
              <p className="text-sm text-muted-foreground">
                {kids.length} sub-categor{kids.length === 1 ? "y" : "ies"}: {kids.map(labelOf).join(", ")}
              </p>
            ) : null}
            <section aria-labelledby="retire" className="space-y-2 rounded-2xl border border-destructive/30 p-4">
              <h3 id="retire" className="font-semibold">
                Retire this category
              </h3>
              <p className="text-sm text-muted-foreground">It leaves the menu and sellers can't pick it any more. The replacement is recorded; products already filed here keep this category until they're edited. It can't be undone from here.</p>
              {retiring ? (
                <>
                  <Label htmlFor="replacement">Replace with</Label>
                  <select id="replacement" value={replacement} onChange={(e) => setReplacement(e.target.value)} className="h-10 w-full rounded-4xl border bg-input/30 px-3 text-sm">
                    <option value="">Choose a category</option>
                    {candidates.map((m) => (
                      <option key={m.id} value={m.id}>
                        {pathOf(m, nodes)}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button variant="destructive" disabled={!replacement || retire.isPending} onClick={() => retire.mutate()}>
                      {retire.isPending ? <Spinner /> : null} Retire
                    </Button>
                    <Button variant="ghost" onClick={() => setRetiring(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="outline" onClick={() => setRetiring(true)} disabled={kids.length > 0}>
                  Retire…
                </Button>
              )}
              {kids.length > 0 ? <p className="text-xs text-muted-foreground">Move or retire its sub-categories first.</p> : null}
            </section>
          </>
        )}
      </div>
    </>
  )
}

function AddPanel({ parent, onDone }: { parent: CategoryNode | null; onDone: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState("")
  const add = useMutation({
    mutationFn: () => createCategory({ code: `${parent ? `${parent.code ?? parent.handle}_` : ""}${codeFrom(name)}`.slice(0, 80), name: name.trim(), parentId: parent?.id ?? null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories"] })
      toast.success("Added as proposed — make it live when it's ready.")
      onDone()
    },
    onError: (e) => toast.error(errText(e)),
  })
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-left">{parent ? `New sub-category in ${labelOf(parent)}` : "New top-level category"}</SheetTitle>
        <SheetDescription className="text-left">New categories start as proposed, so nothing changes for buyers until you make it live.</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-8">
        <div className="space-y-1.5">
          <Label htmlFor="new-name">Name</Label>
          <Input id="new-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hair extensions" autoFocus />
        </div>
        <Button disabled={!codeFrom(name) || add.isPending} onClick={() => add.mutate()}>
          {add.isPending ? <Spinner /> : null} Add category
        </Button>
      </div>
    </>
  )
}
