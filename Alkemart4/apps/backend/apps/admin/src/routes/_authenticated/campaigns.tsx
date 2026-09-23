import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  adminCampaigns,
  type AdminCampaign,
  type AdminCampaignDetail,
} from "../../lib/api"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Badge, Button, Modal, Skeleton, EmptyState, Input, Select,
  SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, Card,
} from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Plus, Eye, ChartBar } from "@phosphor-icons/react"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/campaigns")({
  component: CampaignsPage,
})

const STATUSES = ["all", "draft", "review", "scheduled", "live", "ended"] as const
const OBJECTIVES = ["sale", "launch", "clearance", "brand"] as const
const TRANSITIONS: Record<string, string[]> = {
  draft: ["submit"],
  review: ["approve", "reopen"],
  scheduled: ["publish", "end"],
  live: ["end"],
  ended: [],
}

function statusBadge(status: string) {
  if (status === "live") return <Badge variant="success">Live</Badge>
  if (status === "ended") return <Badge variant="secondary">Ended</Badge>
  if (status === "review") return <Badge variant="warning">In review</Badge>
  if (status === "scheduled") return <Badge variant="warning">Scheduled</Badge>
  return <Badge variant="outline">Draft</Badge>
}

function CampaignsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["campaigns", status],
    queryFn: () => adminCampaigns.list(status === "all" ? undefined : status),
  })
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["campaigns"] })
  }

  const items = data?.items ?? []

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
        <PageHeader
          title="Campaigns"
          description="Schedule eligible products into homepage placements. Only reviewed, scheduled inventory reaches buyers."
        />
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
          >
            {s === "all" ? "All" : s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : isError ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load campaigns.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No campaigns"
          description="Create a draft, attach products and a creative, then submit it for review."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead>Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/60"
                  onClick={() => setSelectedId(c.id)}
                >
                  <TableCell className="font-bold">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.placementCode}</TableCell>
                  <TableCell>{statusBadge(c.status)}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.priority}</TableCell>
                  <TableCell>{c.sponsored ? "Sponsored" : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {selectedId ? (
        <CampaignDetail id={selectedId} onClose={() => { setSelectedId(null); invalidate() }} />
      ) : null}
      {showCreate ? (
        <CreateCampaignModal onClose={() => { setShowCreate(false); invalidate() }} />
      ) : null}
    </PageShell>
  )
}

function CreateCampaignModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("")
  const [placementCode, setPlacementCode] = useState("hero")
  const [objective, setObjective] =
    useState<AdminCampaign["objective"]>("sale")
  const [priority, setPriority] = useState("0")
  const [sponsored, setSponsored] = useState(false)
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [placements, setPlacements] = useState<{ code: string; job: string }[]>([])

  useEffect(() => {
    adminCampaigns.placements().then(
      (d) => setPlacements(d.items),
      () => setPlacements([]),
    )
  }, [])

  const create = useMutation({
    mutationFn: () =>
      adminCampaigns.create({
        name: name.trim(),
        placementCode,
        objective,
        priority: Number(priority) || 0,
        sponsored,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
      }),
    onSuccess: () => {
      toast.success("Draft created — attach products and a creative, then submit.")
      onClose()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create campaign."),
  })

  return (
    <Modal isOpen onClose={onClose} title="New campaign">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="cp-name">Name</label>
          <Input id="cp-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Harmattan Phone Sale" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="cp-placement">Placement</label>
            <Select value={placementCode} onValueChange={setPlacementCode}>
              <SelectTrigger id="cp-placement"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(placements.length > 0 ? placements : [{ code: "hero", job: "Homepage hero" }]).map((p) => (
                  <SelectItem key={p.code} value={p.code}>{p.code} — {p.job}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="cp-objective">Objective</label>
            <Select value={objective} onValueChange={(v) => setObjective(v as AdminCampaign["objective"])}>
              <SelectTrigger id="cp-objective"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="cp-priority">Priority</label>
            <Input id="cp-priority" type="number" min="0" step="1" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium pt-6">
            <input
              type="checkbox"
              checked={sponsored}
              onChange={(e) => setSponsored(e.target.checked)}
              className="h-4 w-4"
            />
            Paid (Sponsored label)
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="cp-starts">Starts</label>
            <Input id="cp-starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="cp-ends">Ends</label>
            <Input id="cp-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !name.trim()}>
            {create.isPending ? "Creating…" : "Create draft"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CampaignDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [previewWidth, setPreviewWidth] = useState<"phone" | "tablet" | "desktop">("desktop")
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["campaigns", id],
    queryFn: () => adminCampaigns.get(id),
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["campaigns", id] })
    void refetch()
  }
  const detail: AdminCampaignDetail | undefined = data

  const transition = useMutation({
    mutationFn: (action: "submit" | "approve" | "publish" | "end" | "reopen") =>
      adminCampaigns.transition(id, action),
    onSuccess: (d) => {
      toast.success(`Campaign is now ${d.campaign.status}.`)
      refresh()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Transition failed."),
  })

  return (
    <Modal isOpen onClose={onClose} title={detail?.campaign.name ?? "Campaign"}>
      {isLoading || !detail ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          <div className="flex items-center gap-2 flex-wrap">
            {statusBadge(detail.campaign.status)}
            <span className="font-mono text-xs text-muted-foreground">{detail.campaign.placementCode}</span>
            <span className="text-xs text-muted-foreground">priority {detail.campaign.priority}</span>
            {detail.campaign.sponsored ? <Badge>Sponsored</Badge> : null}
            <span className="ml-auto flex gap-2">
              {(TRANSITIONS[detail.campaign.status] ?? []).map((action) => (
                <Button
                  key={action}
                  size="sm"
                  variant={action === "end" ? "destructive" : "outline"}
                  disabled={transition.isPending}
                  onClick={() => transition.mutate(action as "submit" | "approve" | "publish" | "end" | "reopen")}
                >
                  {action}
                </Button>
              ))}
            </span>
          </div>

          <CreativeEditor detail={detail} onChanged={refresh} />
          <SetsEditor detail={detail} onChanged={refresh} />
          <TermsEditor detail={detail} onChanged={refresh} />
          <PreviewPane detail={detail} width={previewWidth} onWidth={setPreviewWidth} />
          <AuditTrail detail={detail} />
          <ReportPane id={id} />
        </div>
      )}
    </Modal>
  )
}

function CreativeEditor({ detail, onChanged }: { detail: AdminCampaignDetail; onChanged: () => void }) {
  const [title, setTitle] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [link, setLink] = useState("")
  const [slot, setSlot] = useState<"desktop" | "mobile">("desktop")
  const add = useMutation({
    mutationFn: () =>
      adminCampaigns.addCreative(detail.campaign.id, {
        slot,
        title: title.trim(),
        imageUrl: imageUrl.trim() || null,
        link: link.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Creative added.")
      setTitle("")
      setImageUrl("")
      setLink("")
      onChanged()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add creative."),
  })
  const remove = useMutation({
    mutationFn: (creativeId: string) => adminCampaigns.removeCreative(detail.campaign.id, creativeId),
    onSuccess: onChanged,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove creative."),
  })
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-sm">Creatives</h3>
      {detail.creatives.length === 0 ? (
        <p className="text-xs text-muted-foreground">None yet — publishing requires at least one.</p>
      ) : (
        <ul className="space-y-1">
          {detail.creatives.map((cr) => (
            <li key={cr.id} className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{cr.slot}</Badge>
              <span className="font-medium truncate">{cr.title}</span>
              <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => remove.mutate(cr.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input value={title} maxLength={120} placeholder="Creative title" onChange={(e) => setTitle(e.target.value)} aria-label="Creative title" />
        <Select value={slot} onValueChange={(v) => setSlot(v as "desktop" | "mobile")}>
          <SelectTrigger aria-label="Creative slot"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="desktop">Desktop</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
          </SelectContent>
        </Select>
        <Input value={imageUrl} placeholder="Image URL (optional)" onChange={(e) => setImageUrl(e.target.value)} aria-label="Creative image" />
        <Input value={link} placeholder="Link (optional)" onChange={(e) => setLink(e.target.value)} aria-label="Creative link" />
      </div>
      <Button size="sm" variant="outline" disabled={add.isPending || !title.trim()} onClick={() => add.mutate()}>
        Add creative
      </Button>
    </section>
  )
}

function SetsEditor({ detail, onChanged }: { detail: AdminCampaignDetail; onChanged: () => void }) {
  const [productIds, setProductIds] = useState(
    (detail.productSet?.productIds ?? []).join("\n"),
  )
  const [sellerIds, setSellerIds] = useState(
    (detail.sellerSet?.sellerIds ?? []).join("\n"),
  )
  const save = useMutation({
    mutationFn: async () => {
      const pids = productIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
      const sids = sellerIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
      await adminCampaigns.setProducts(detail.campaign.id, [...new Set(pids)])
      await adminCampaigns.setSellers(detail.campaign.id, [...new Set(sids)])
    },
    onSuccess: () => {
      toast.success("Sets saved — eligibility re-checks at serve time.")
      onChanged()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save sets."),
  })
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-sm">Product & seller sets</h3>
      <p className="text-xs text-muted-foreground">
        One ID per line. Ineligible products (unpublished, unstocked, imageless)
        fall out at serve time with reasons — check the buyer preview below.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Textarea
          value={productIds}
          rows={4}
          placeholder="product ids…"
          onChange={(e) => setProductIds(e.target.value)}
          aria-label="Product ids"
          className="font-mono text-xs"
        />
        <Textarea
          value={sellerIds}
          rows={4}
          placeholder="seller ids (optional targeting)…"
          onChange={(e) => setSellerIds(e.target.value)}
          aria-label="Seller ids"
          className="font-mono text-xs"
        />
      </div>
      <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>
        Save sets
      </Button>
    </section>
  )
}

function TermsEditor({ detail, onChanged }: { detail: AdminCampaignDetail; onChanged: () => void }) {
  const { data: termsData } = useQuery({
    queryKey: ["campaigns", "terms"],
    queryFn: () => adminCampaigns.listTerms(),
  })
  const [label, setLabel] = useState("")
  const [summary, setSummary] = useState("")
  const attach = useMutation({
    mutationFn: (termsId: string | null) => adminCampaigns.patch(detail.campaign.id, { termsId }),
    onSuccess: () => {
      toast.success("Terms attached.")
      onChanged()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to attach terms."),
  })
  const create = useMutation({
    mutationFn: () => adminCampaigns.createTerms({ label: label.trim(), summary: summary.trim() }),
    onSuccess: (d) => {
      toast.success("Terms created and attached.")
      setLabel("")
      setSummary("")
      attach.mutate(d.terms.id)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create terms."),
  })
  const terms = termsData?.items ?? []
  const editable = detail.campaign.status === "draft" || detail.campaign.status === "review"
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-sm">Promotion terms</h3>
      {detail.terms ? (
        <p className="text-sm">
          <span className="font-bold">{detail.terms.label}</span>
          <span className="text-muted-foreground"> — {detail.terms.summary}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">None attached.</p>
      )}
      {editable ? (
        <>
          <div className="flex gap-2">
            <Select
              value={detail.terms?.id ?? ""}
              onValueChange={(v) => attach.mutate(v || null)}
            >
              <SelectTrigger aria-label="Attach terms"><SelectValue placeholder="Attach existing…" /></SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={label} maxLength={120} placeholder="New terms label" onChange={(e) => setLabel(e.target.value)} aria-label="New terms label" />
            <Input value={summary} maxLength={2000} placeholder="New terms summary" onChange={(e) => setSummary(e.target.value)} aria-label="New terms summary" />
          </div>
          <Button size="sm" variant="outline" disabled={create.isPending || !label.trim() || !summary.trim()} onClick={() => create.mutate()}>
            Create and attach
          </Button>
        </>
      ) : null}
    </section>
  )
}

function PreviewPane({
  detail,
  width,
  onWidth,
}: {
  detail: AdminCampaignDetail
  width: "phone" | "tablet" | "desktop"
  onWidth: (w: "phone" | "tablet" | "desktop") => void
}) {
  const [course, setCourse] = useState<null | {
    placements: { code: string; campaigns: { id: string; name: string }[] }[]
  }>(null)
  const [checked, setChecked] = useState(false)
  const check = async () => {
    setChecked(false)
    try {
      const base = (
        (import.meta.env.VITE_ALKEMART_API_URL as string | undefined) ??
        (import.meta.env.VITE_MERCUR_BACKEND_URL as string | undefined) ??
        ""
      ).replace(/\/$/, "")
      const res = await fetch(`${base}/store/course`, { headers: { Accept: "application/json" } })
      if (!res.ok) throw new Error(`course ${res.status}`)
      setCourse(await res.json())
    } catch {
      setCourse(null)
    }
    setChecked(true)
  }
  const widthClass = width === "phone" ? "max-w-sm" : width === "tablet" ? "max-w-2xl" : "max-w-full"
  const live = course?.placements.flatMap((p) => p.campaigns).some((c) => c.id === detail.campaign.id) ?? false
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-sm">Buyer preview</h3>
        <span className="ml-auto flex gap-1">
          {(["phone", "tablet", "desktop"] as const).map((w) => (
            <Button key={w} size="sm" variant={width === w ? "default" : "outline"} className="h-7 text-xs" onClick={() => onWidth(w)}>
              {w}
            </Button>
          ))}
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={() => void check()}>
        <Eye className="h-4 w-4 mr-1" /> Check live course
      </Button>
      {checked ? (
        <div className={`${widthClass} rounded-xl border border-border bg-muted/30 p-4 text-sm`}>
          {live ? (
            <p>
              <span className="font-bold text-emerald-700">Live on the homepage</span> — buyers see
              “{detail.campaign.name}” in <span className="font-mono text-xs">{detail.campaign.placementCode}</span> at {width} width.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Not on the live course — {detail.campaign.status === "live"
                ? "its products are currently ineligible (unpublished, unstocked, or imageless) or outranked."
                : `it is ${detail.campaign.status}; only live campaigns serve.`}
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}

function AuditTrail({ detail }: { detail: AdminCampaignDetail }) {
  if (detail.audit.length === 0) return null
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-sm">History</h3>
      <ol className="space-y-1 text-xs text-muted-foreground">
        {detail.audit.map((a) => (
          <li key={a.id}>
            <span className="font-bold text-foreground">{a.action}</span>
            {a.actor ? ` by ${a.actor}` : ""} · {new Date(a.createdAt).toLocaleString()}
          </li>
        ))}
      </ol>
    </section>
  )
}

function ReportPane({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["campaigns", id, "report"],
    queryFn: () => adminCampaigns.report(id),
  })
  if (!data || (data.views === 0 && data.selects === 0)) return null
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-sm flex items-center gap-1">
        <ChartBar className="h-4 w-4" /> Measured reach
      </h3>
      <p className="text-sm">
        <span className="font-bold tabular-nums">{data.views}</span> views ·{" "}
        <span className="font-bold tabular-nums">{data.selects}</span> selects
      </p>
      {data.byPlacement.map((p) => (
        <p key={p.placementCode} className="text-xs text-muted-foreground font-mono">
          {p.placementCode}: {p.views} views / {p.selects} selects
        </p>
      ))}
    </section>
  )
}
