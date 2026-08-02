import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminDisputes, type AdminDispute } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Skeleton, EmptyState, Modal, Textarea, Input } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Scale, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export const Route = createFileRoute("/_authenticated/disputes")({
  component: DisputesPage,
})

function DisputeDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["dispute", id],
    queryFn: () => adminDisputes.retrieve(id),
    enabled: !!id,
  })

  const [resolveModal, setResolveModal] = useState(false)
  const [decision, setDecision] = useState<"favor_buyer" | "favor_seller" | "partial">("favor_buyer")
  const [partialAmount, setPartialAmount] = useState("")
  const [note, setNote] = useState("")

  const resolve = useMutation({
    mutationFn: () =>
      adminDisputes.resolve(id, {
        decision,
        refund_amount: decision === "partial" ? (parseFloat(partialAmount) * 100 || undefined) : undefined,
        note: note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-disputes"] })
      qc.invalidateQueries({ queryKey: ["dispute", id] })
      toast.success("Dispute resolved")
      setResolveModal(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to resolve"),
  })

  const dispute = data?.dispute
  const meta = dispute?.metadata as Record<string, unknown> | undefined
  const formatGhs = (n = 0) => new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (!dispute) return <div className="text-destructive text-sm">Failed to load dispute.</div>

  const isOpen = meta?.dispute_status === "open"

  return (
    <div className="space-y-6">
      <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to disputes
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            Dispute — Return {dispute.display_id ? `#${dispute.display_id}` : dispute.id.slice(-8)}
            <Badge variant={meta?.dispute_status === "resolved" ? "success" : "destructive"} className="capitalize">
              {String(meta?.dispute_status || "open")}
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Order: {dispute.order?.display_id ? `#${dispute.order.display_id}` : dispute.order_id?.slice(-8)} ·{" "}
            {dispute.created_at ? format(new Date(dispute.created_at), "MMM d, yyyy") : ""}
          </p>
        </div>
        {isOpen && (
          <Button className="gap-2" onClick={() => setResolveModal(true)}>
            <Scale className="h-4 w-4" />
            Resolve Dispute
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {meta?.dispute_reason && (
          <div className="p-4 bg-muted/30 rounded-xl border">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Dispute Reason</p>
            <p className="text-sm">{String(meta.dispute_reason)}</p>
          </div>
        )}
        {meta?.dispute_opened_at && (
          <div className="p-4 bg-muted/30 rounded-xl border">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Opened</p>
            <p className="text-sm">{format(new Date(String(meta.dispute_opened_at)), "PPP")}</p>
          </div>
        )}
        {dispute.order && (
          <div className="p-4 bg-muted/30 rounded-xl border">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Order Value</p>
            <p className="text-sm font-bold">{formatGhs((dispute.order.total || 0) / 100)}</p>
          </div>
        )}
        {meta?.resolved_at && (
          <div className="p-4 bg-success/10 rounded-xl border border-success/20">
            <p className="text-xs font-bold uppercase text-success mb-1">Resolution</p>
            <p className="text-sm font-bold capitalize">{String(meta.resolution || "resolved")}</p>
            {meta.resolution_note && <p className="text-xs text-muted-foreground mt-1">{String(meta.resolution_note)}</p>}
          </div>
        )}
      </div>

      <Modal isOpen={resolveModal} onClose={() => setResolveModal(false)}>
        <div className="p-6 space-y-5">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Resolve Dispute
          </h3>

          <div className="space-y-2">
            <label className="text-sm font-medium">Decision</label>
            <div className="grid grid-cols-3 gap-2">
              {(["favor_buyer", "favor_seller", "partial"] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDecision(d)}
                  className={`p-3 rounded-xl border-2 text-sm font-bold text-center transition-all ${
                    decision === d
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40 text-muted-foreground"
                  }`}
                >
                  {d === "favor_buyer" ? "Favor Buyer" : d === "favor_seller" ? "Favor Seller" : "Partial"}
                </button>
              ))}
            </div>
          </div>

          {decision === "partial" && (
            <div>
              <label className="text-sm font-medium">Partial Refund Amount (GHS)</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">GH₵</span>
                <Input
                  type="number"
                  className="pl-12"
                  placeholder="0.00"
                  value={partialAmount}
                  onChange={e => setPartialAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Note (optional)</label>
            <Textarea
              className="mt-1 h-20"
              placeholder="Resolution note for the record…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResolveModal(false)}>Cancel</Button>
            <Button
              isLoading={resolve.isPending}
              onClick={() => resolve.mutate()}
              disabled={decision === "partial" && (!partialAmount || isNaN(parseFloat(partialAmount)))}
            >
              Submit Resolution
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function DisputesPage() {
  const [offset, setOffset] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const limit = 50

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-disputes", offset],
    queryFn: () => adminDisputes.list({ limit, offset }),
  })

  const disputes = data?.disputes || []

  if (selectedId) {
    return (
      <PageShell>
        <DisputeDetail id={selectedId} onBack={() => setSelectedId(null)} />
      </PageShell>
    )
  }

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load disputes.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Disputes" description="Escalated return disputes requiring admin resolution." />

      <div className="border rounded-xl bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : disputes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={<Scale className="h-8 w-8 opacity-40" />}
                    title="No open disputes"
                    description="All return escalations have been resolved."
                  />
                </TableCell>
              </TableRow>
            ) : (
              disputes.map((d: AdminDispute) => {
                const meta = d.metadata as Record<string, unknown> | undefined
                return (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-bold">
                      {d.display_id ? `#${d.display_id}` : d.id.slice(-8)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.order?.display_id ? `#${d.order.display_id}` : d.order_id?.slice(-8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta?.dispute_status === "resolved" ? "success" : "destructive"} className="capitalize">
                        {String(meta?.dispute_status || "open")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {d.created_at ? format(new Date(d.created_at), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(d.id)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {disputes.length ? `${offset + 1}–${offset + disputes.length}` : "0"} of {data?.count ?? "…"}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}>
            Previous
          </Button>
          <Button variant="outline" disabled={!data?.count || offset + limit >= (data?.count || 0)} onClick={() => setOffset(o => o + limit)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  )
}
