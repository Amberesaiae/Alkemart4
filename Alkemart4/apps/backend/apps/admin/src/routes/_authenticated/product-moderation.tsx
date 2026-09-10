import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useProducts } from "../../hooks/use-products"
import { moderation, type ProposedProduct } from "../../lib/api"
import { Button, Badge, Modal, Textarea, Skeleton, EmptyState, Checkbox } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/product-moderation")({
  component: ProductModerationPage,
})

function ConfirmDialog({ open, onOpenChange, title, onConfirm, confirmLabel = "Confirm", disabled }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onConfirm: () => void
  confirmLabel?: string
  disabled?: boolean
}) {
  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={title}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>Cancel</Button>
          <Button onClick={onConfirm} disabled={disabled}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">The listing will go live on the storefront immediately.</p>
    </Modal>
  )
}

function ProductModerationPage() {
  const { products, isLoading, isError, refetch, confirm, reject, requestChanges, isConfirming, isRejecting, isRequestingChanges } = useProducts()
  const queryClient = useQueryClient()

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "reject" | "request-changes" | null;
    productId: string | null;
  }>({ isOpen: false, type: null, productId: null })

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; productId: string | null }>({
    isOpen: false,
    productId: null,
  })

  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  // Bulk selection + execution (raw moderation fns: single summary toast, not per-item)
  const [selected, setSelected] = useState<string[]>([])
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false)
  const [bulkReason, setBulkReason] = useState("")
  const [bulkWorking, setBulkWorking] = useState(false)
  const allSelected = products.length > 0 && selected.length === products.length
  const toggleOne = (id: string) =>
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
  const toggleAll = () => setSelected(s => (s.length === products.length ? [] : products.map(p => p.id)))

  const runBulk = async (type: "approve" | "reject", ids: string[], bulkReasonText: string) => {
    setBulkWorking(true)
    const byId = new Map(products.map(p => [p.id, p.title || "Untitled"]))
    const failures: string[] = []
    for (const id of ids) {
      try {
        if (type === "approve") await moderation.confirmProduct(id)
        else await moderation.rejectProduct(id, bulkReasonText)
      } catch {
        failures.push(byId.get(id) ?? id)
      }
    }
    setBulkWorking(false)
    setSelected([])
    setBulkConfirmOpen(false)
    setBulkRejectOpen(false)
    setBulkReason("")
    queryClient.invalidateQueries({ queryKey: ["products-queue"] })
    if (failures.length === 0) {
      toast.success(type === "approve" ? `Approved ${ids.length} products` : `Rejected ${ids.length} products`)
    } else {
      setError(`Some items did not ${type === "approve" ? "approve" : "reject"}: ${failures.join("; ")}`)
    }
  }

  const handleConfirm = async () => {
    if (!confirmModal.productId) return
    try {
      setError(null)
      await confirm(confirmModal.productId)
      setConfirmModal({ isOpen: false, productId: null })
    } catch {
      setError("Failed to perform action")
    }
  }

  const handleAction = async () => {
    if (!modalState.productId || !modalState.type || !reason.trim()) return
    try {
      setError(null)
      if (modalState.type === "reject") {
        await reject({ id: modalState.productId, reason })
      } else {
        await requestChanges({ id: modalState.productId, reason })
      }
      setModalState({ isOpen: false, type: null, productId: null })
      setReason("")
    } catch {
      setError("Failed to perform action")
    }
  }

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load products.</span>
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
        <div className="grid grid-cols-1 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="flex flex-col sm:flex-row gap-6 p-6 border rounded-xl bg-card">
              <Skeleton className="h-32 w-32 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex sm:flex-col gap-2 justify-end sm:w-40 shrink-0">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Product Review" description="Review proposed listings. Approve to publish, request changes, or reject." />

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>
      )}

      {products.length === 0 ? (
        <EmptyState title="All caught up" description="No products awaiting review." />
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => toggleAll()}
              aria-label={allSelected ? "Deselect all products" : "Select all products"}
            />
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {selected.length === 0
                ? `${products.length} awaiting review`
                : `${selected.length} of ${products.length} selected`}
            </span>
            {selected.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4">
            {products.map((p: ProposedProduct) => (
              <div key={p.id} className="flex flex-col sm:flex-row gap-6 p-6 border rounded-xl bg-card shadow-sm">
                <Checkbox
                  checked={selected.includes(p.id)}
                  onCheckedChange={() => toggleOne(p.id)}
                  aria-label={`Select ${p.title || "product"} for bulk action`}
                  className="mt-1 shrink-0"
                />
              <div className="h-32 w-32 shrink-0 rounded-lg overflow-hidden bg-muted border flex items-center justify-center">
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-muted-foreground text-sm">No Image</span>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{p.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Seller: <span className="font-medium text-foreground">{p.seller?.name || "Unknown"}</span> (@{p.seller?.handle || p.seller?.id || "…"})
                    </p>
                  </div>
                  {p.quality_score !== undefined && (
                    <Badge variant={
                      p.quality_score >= 90 ? "success" :
                      p.quality_score >= 70 ? "default" :
                      p.quality_score >= 50 ? "warning" :
                      p.quality_score >= 30 ? "secondary" :
                      "destructive"
                    }>
                      {p.quality_score >= 90 ? "Excellent" :
                       p.quality_score >= 70 ? "Good" :
                       p.quality_score >= 50 ? "Average" :
                       p.quality_score >= 30 ? "Poor" :
                       "Very Low"}: {p.quality_score}
                    </Badge>
                  )}
                </div>
                {p.created_at ? (
                  <p className="text-xs text-muted-foreground">
                    Submitted: {new Date(p.created_at).toLocaleDateString()}
                  </p>
                ) : null}
                {p.flags && p.flags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Auto-check flags">
                    {p.flags.map(f => (
                      <Badge key={f.rule} variant="warning" className="text-xs font-semibold">
                        ⚑ {f.message}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex sm:flex-col gap-2 justify-end shrink-0 sm:w-40">
                <Button className="w-full" onClick={() => setConfirmModal({ isOpen: true, productId: p.id })}>
                  Approve
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setModalState({ isOpen: true, type: "request-changes", productId: p.id })}>
                  Request Changes
                </Button>
                <Button variant="destructive" className="w-full" onClick={() => setModalState({ isOpen: true, type: "reject", productId: p.id })}>
                  Reject
                </Button>
              </div>
              </div>
            ))}
          </div>

          {selected.length > 0 && (
            <div
              role="toolbar"
              aria-label="Bulk moderation actions"
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
              <Button size="sm" onClick={() => setBulkConfirmOpen(true)}>
                Approve selected
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmModal.isOpen}
        onOpenChange={(open) => setConfirmModal({ isOpen: open, productId: open ? confirmModal.productId : null })}
        title="Approve Product"
        onConfirm={handleConfirm}
        confirmLabel="Approve"
        disabled={isConfirming}
      />

      <Modal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        title={`Approve ${selected.length} products`}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)} disabled={bulkWorking}>Cancel</Button>
            <Button onClick={() => runBulk("approve", selected, "")} disabled={bulkWorking}>
              Approve all
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          These listings will go live on the storefront immediately.
        </p>
      </Modal>

      <Modal
        isOpen={bulkRejectOpen}
        onClose={() => { setBulkRejectOpen(false); setBulkReason("") }}
        title={`Reject ${selected.length} products`}
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
            One reason is sent to all selected sellers.
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

      <Modal isOpen={modalState.isOpen} onClose={() => { setModalState({ isOpen: false, type: null, productId: null }); setError(null) }}
        title={modalState.type === "reject" ? "Reject Product" : "Request Changes"}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setModalState({ isOpen: false, type: null, productId: null }); setError(null) }}>
              Cancel
            </Button>
            <Button variant={modalState.type === "reject" ? "destructive" : "default"} onClick={handleAction}
              disabled={!reason.trim() || isRejecting || isRequestingChanges}>
              {isRejecting || isRequestingChanges ? "Processing..." : "Confirm"}
            </Button>
          </>
        }>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {modalState.type === "reject"
              ? "Provide a reason for rejecting this product. This will be sent to the seller."
              : "What changes does the seller need to make before this can be approved?"}
          </p>
          <Textarea placeholder="Enter reason..." value={reason} onChange={(e) => setReason(e.target.value)} autoFocus className="h-32" />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </Modal>
    </PageShell>
  )
}
