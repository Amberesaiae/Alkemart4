import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useProducts } from "../../hooks/use-products"
import type { ProposedProduct } from "../../lib/api"
import { Button, Badge, Modal, Textarea, Skeleton, EmptyState } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { t } from "../../lib/t"

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
    <Modal isOpen={open} onClose={() => onOpenChange(false)}>
      <div className="p-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>Cancel</Button>
          <Button onClick={onConfirm} disabled={disabled}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ProductModerationPage() {
  const { products, isLoading, confirm, reject, requestChanges, isConfirming, isRejecting, isRequestingChanges } = useProducts()

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
      <PageHeader title={t("moderation.title", "Product Review")} description={t("moderation.description", "Review proposed listings. Approve to publish, request changes, or reject.")} />

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>
      )}

      {products.length === 0 ? (
        <EmptyState title={t("moderation.empty", "All caught up")} description={t("moderation.emptyHint", "No products awaiting review.")} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {products.map((p: ProposedProduct) => (
            <div key={p.id} className="flex flex-col sm:flex-row gap-6 p-6 border rounded-xl bg-card shadow-sm">
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
                      Seller: <span className="font-medium text-foreground">{p.seller.name}</span> (@{p.seller.handle})
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
                <p className="text-xs text-muted-foreground">
                  Submitted: {new Date(p.created_at).toLocaleDateString()}
                </p>
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
      )}

      <ConfirmDialog
        open={confirmModal.isOpen}
        onOpenChange={(open) => setConfirmModal({ isOpen: open, productId: open ? confirmModal.productId : null })}
        title="Approve Product"
        onConfirm={handleConfirm}
        confirmLabel="Approve"
        disabled={isConfirming}
      />

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
