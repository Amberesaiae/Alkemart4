import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useSellers } from "../../hooks/use-sellers"
import { sellerQueue, type SellerApplication } from "../../lib/api"
import { Button, Modal, Textarea, Skeleton, EmptyState, Checkbox } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/sellers-queue")({
  component: SellersQueuePage,
})

function SellerCard({ seller, onApprove, onSuspend, selected, onSelect }: {
  seller: SellerApplication
  onApprove?: () => void
  onSuspend?: () => void
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <div className="p-6 border rounded-xl bg-card shadow-sm flex flex-col justify-between">
      <div className="mb-4">
        <div className="flex items-start gap-3">
          {onSelect && (
            <Checkbox
              checked={selected ?? false}
              onCheckedChange={() => onSelect()}
              aria-label={`Select ${seller.name || "shop"} for bulk action`}
              className="mt-1 shrink-0"
            />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-lg">
              <Link to={"/sellers/$id"} params={{ id: seller.id }} className="hover:text-primary transition-colors">
                {seller.name || "Unnamed Shop"}
              </Link>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">@{seller.handle}</p>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-sm">
          <p><span className="font-medium">Owner:</span> {seller.member?.first_name} {seller.member?.last_name}</p>
          <p><span className="font-medium">Email:</span> {seller.member?.email}</p>
          {seller.created_at ? (
            <p><span className="font-medium">Applied:</span> {new Date(seller.created_at).toLocaleDateString()}</p>
          ) : null}
        </div>
      </div>
      {(onApprove || onSuspend) && (
        <div className="flex gap-3 pt-4 border-t mt-auto">
          {onApprove && <Button className="flex-1" onClick={onApprove}>Approve</Button>}
          {onSuspend && <Button variant="outline" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={onSuspend}>Reject</Button>}
        </div>
      )}
    </div>
  )
}

function SellersQueuePage() {
  const { pending, rejected, isLoading, isError, refetch, approve, suspend, isApproving, isSuspending } = useSellers()
  const queryClient = useQueryClient()

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; sellerId: string | null }>({
    isOpen: false,
    sellerId: null,
  })

  const [suspendModal, setSuspendModal] = useState<{ isOpen: boolean; sellerId: string | null }>({
    isOpen: false,
    sellerId: null,
  })
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Bulk selection (raw sellerQueue fns: one summary toast, not per-item)
  const [selected, setSelected] = useState<string[]>([])
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false)
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false)
  const [bulkReason, setBulkReason] = useState("")
  const [bulkWorking, setBulkWorking] = useState(false)
  const allSelected = pending.length > 0 && selected.length === pending.length
  const toggleOne = (id: string) =>
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
  const toggleAll = () => setSelected(s => (s.length === pending.length ? [] : pending.map(p => p.id)))

  const runBulk = async (type: "approve" | "reject", ids: string[], bulkReasonText: string) => {
    setBulkWorking(true)
    const byId = new Map(pending.map(p => [p.id, p.name || p.handle || "Shop"]))
    const failures: string[] = []
    for (const id of ids) {
      try {
        if (type === "approve") await sellerQueue.approve(id)
        else await sellerQueue.suspend(id, bulkReasonText)
      } catch {
        failures.push(byId.get(id) ?? id)
      }
    }
    setBulkWorking(false)
    setSelected([])
    setBulkApproveOpen(false)
    setBulkRejectOpen(false)
    setBulkReason("")
    queryClient.invalidateQueries({ queryKey: ["sellers-queue"] })
    if (failures.length === 0) {
      toast.success(type === "approve" ? `Approved ${ids.length} sellers` : `Rejected ${ids.length} applications`)
    } else {
      setError(`Some items did not ${type === "approve" ? "approve" : "reject"}: ${failures.join("; ")}`)
    }
  }

  const handleApprove = async () => {
    if (!confirmModal.sellerId) return
    try {
      setError(null)
      await approve(confirmModal.sellerId)
      setConfirmModal({ isOpen: false, sellerId: null })
    } catch {
      setError("Failed to approve seller")
    }
  }

  const handleSuspend = async () => {
    if (!suspendModal.sellerId || !reason.trim()) return
    try {
      setError(null)
      await suspend({ id: suspendModal.sellerId, reason })
      setSuspendModal({ isOpen: false, sellerId: null })
      setReason("")
    } catch {
      setError("Failed to reject application")
    }
  }

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load seller applications.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </PageShell>
    )
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <section>
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="p-6 border rounded-xl bg-card flex flex-col">
                <Skeleton className="h-6 w-40 mb-3" />
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-4 w-56 mb-2" />
                <Skeleton className="h-4 w-32 mb-4" />
                <div className="flex gap-3 pt-4 border-t mt-auto">
                  <Skeleton className="h-10 flex-1 rounded-lg" />
                  <Skeleton className="h-10 flex-1 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Seller Applications" description="Review new applications. Approve to open their shop, or reject with a reason." />

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          Pending Approval
          <span className="inline-flex items-center rounded-md border border-primary/30 bg-muted px-2 py-0.5 text-xs font-semibold text-primary">{pending.length}</span>
        </h2>

        {pending.length === 0 ? (
          <EmptyState title="No pending applications" />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => toggleAll()}
                aria-label={allSelected ? "Deselect all applications" : "Select all applications"}
              />
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {selected.length === 0
                  ? `${pending.length} awaiting review`
                  : `${selected.length} of ${pending.length} selected`}
              </span>
              {selected.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                  Clear
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pending.map((seller: SellerApplication) => (
                <SellerCard key={seller.id} seller={seller}
                  selected={selected.includes(seller.id)}
                  onSelect={() => toggleOne(seller.id)}
                  onApprove={() => setConfirmModal({ isOpen: true, sellerId: seller.id })}
                  onSuspend={() => setSuspendModal({ isOpen: true, sellerId: seller.id })} />
              ))}
            </div>
            {selected.length > 0 && (
              <div
                role="toolbar"
                aria-label="Bulk seller actions"
                className="sticky bottom-4 mt-4 flex items-center gap-3 rounded-xl border bg-card p-4 shadow-md"
              >
                <span className="text-sm font-semibold" aria-live="polite">
                  {selected.length} selected
                </span>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setSelected([])}>
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { setBulkReason(""); setBulkRejectOpen(true) }}
                >
                  Reject selected
                </Button>
                <Button size="sm" onClick={() => setBulkApproveOpen(true)}>
                  Approve selected
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Rejected Applications</h2>
        {rejected.length === 0 ? (
          <EmptyState title="No rejected applications" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
            {rejected.map((seller: SellerApplication) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
        )}
      </section>

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, sellerId: null })}
        title="Approve Seller"
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmModal({ isOpen: false, sellerId: null })} disabled={isApproving}>Cancel</Button>
            <Button onClick={handleApprove} disabled={isApproving}>Approve</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Their shop will go live immediately. You can suspend it later if needed.</p>
      </Modal>

      <Modal isOpen={suspendModal.isOpen} onClose={() => { setSuspendModal({ isOpen: false, sellerId: null }); setError(null) }}
        title="Reject Seller Application"
        className="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setSuspendModal({ isOpen: false, sellerId: null }); setError(null) }}>Cancel</Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={!reason.trim() || isSuspending}>Reject Application</Button>
          </>
        }>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Tell the applicant why they were rejected. This will be sent to the seller.</p>
          <Textarea placeholder="Reason for rejection..." value={reason} onChange={e => setReason(e.target.value)} className="h-32" />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </Modal>

      <Modal
        isOpen={bulkApproveOpen}
        onClose={() => setBulkApproveOpen(false)}
        title={`Approve ${selected.length} sellers`}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkApproveOpen(false)} disabled={bulkWorking}>Cancel</Button>
            <Button onClick={() => runBulk("approve", selected, "")} disabled={bulkWorking}>
              Approve all
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Their shops will go live immediately. You can suspend them later if needed.
        </p>
      </Modal>

      <Modal
        isOpen={bulkRejectOpen}
        onClose={() => { setBulkRejectOpen(false); setBulkReason("") }}
        title={`Reject ${selected.length} applications`}
        className="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setBulkRejectOpen(false); setBulkReason("") }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => runBulk("reject", selected, bulkReason)}
              disabled={!bulkReason.trim() || bulkWorking}
            >
              Reject all
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            One reason is sent to all selected applicants.
          </p>
          <Textarea
            placeholder="Reason for rejection…"
            value={bulkReason}
            onChange={e => setBulkReason(e.target.value)}
            className="h-32"
            autoFocus
          />
        </div>
      </Modal>
    </PageShell>
  )
}
