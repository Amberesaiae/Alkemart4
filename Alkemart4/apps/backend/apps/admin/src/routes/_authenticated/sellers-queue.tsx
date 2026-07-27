import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useSellers } from "../../hooks/use-sellers"
import { Button, Modal, Textarea, Skeleton, EmptyState } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"

export const Route = createFileRoute("/_authenticated/sellers-queue")({
  component: SellersQueuePage,
})

function SellerCard({ seller, onApprove, onReject }: { seller: any, onApprove?: () => void, onReject?: () => void }) {
  return (
    <div className="p-6 border rounded-xl bg-card shadow-sm flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="font-semibold text-lg">{seller.name || "Unnamed Shop"}</h3>
        <p className="text-sm text-muted-foreground mt-1">@{seller.handle}</p>
        <div className="mt-4 space-y-1 text-sm">
          <p><span className="font-medium">Owner:</span> {seller.member?.first_name} {seller.member?.last_name}</p>
          <p><span className="font-medium">Email:</span> {seller.member?.email}</p>
          <p><span className="font-medium">Applied:</span> {new Date(seller.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      {(onApprove || onReject) && (
        <div className="flex gap-3 pt-4 border-t mt-auto">
          {onApprove && <Button className="flex-1" onClick={onApprove}>Approve</Button>}
          {onReject && <Button variant="destructive" className="flex-1" onClick={onReject}>Reject</Button>}
        </div>
      )}
    </div>
  )
}

function SellersQueuePage() {
  const { pending, rejected, isLoading, approve, suspend, isApproving, isSuspending } = useSellers()

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; sellerId: string | null }>({
    isOpen: false,
    sellerId: null,
  })

  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; sellerId: string | null }>({
    isOpen: false,
    sellerId: null,
  })
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

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

  const handleReject = async () => {
    if (!rejectModal.sellerId || !reason.trim()) return
    try {
      setError(null)
      await suspend({ id: rejectModal.sellerId, reason })
      setRejectModal({ isOpen: false, sellerId: null })
      setReason("")
    } catch {
      setError("Failed to reject seller")
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <section>
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="p-6 border rounded-xl bg-card">
                <Skeleton className="h-6 w-40 mb-3" />
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-4 w-56 mb-2" />
                <Skeleton className="h-4 w-32" />
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
          <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">{pending.length}</span>
        </h2>

        {pending.length === 0 ? (
          <EmptyState title="No pending applications" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((seller: any) => (
              <SellerCard key={seller.id} seller={seller}
                onApprove={() => setConfirmModal({ isOpen: true, sellerId: seller.id })}
                onReject={() => setRejectModal({ isOpen: true, sellerId: seller.id })} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Rejected Applications</h2>
        {rejected.length === 0 ? (
          <EmptyState title="No rejected applications" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
            {rejected.map((seller: any) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
        )}
      </section>

      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, sellerId: null })}>
        <div className="p-6">
          <h3 className="text-lg font-semibold">Approve Seller</h3>
          <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setConfirmModal({ isOpen: false, sellerId: null })} disabled={isApproving}>Cancel</Button>
            <Button onClick={handleApprove} disabled={isApproving}>Approve</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={rejectModal.isOpen} onClose={() => { setRejectModal({ isOpen: false, sellerId: null }); setError(null) }}
        title="Reject Application"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRejectModal({ isOpen: false, sellerId: null }); setError(null) }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!reason.trim() || isSuspending}>Reject</Button>
          </>
        }>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Provide a reason for rejection.</p>
          <Textarea placeholder="Reason for rejection..." value={reason} onChange={e => setReason(e.target.value)} className="h-32" />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </Modal>
    </PageShell>
  )
}
