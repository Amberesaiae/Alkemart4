import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useSellers } from "../../hooks/use-sellers"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"

export const Route = createFileRoute("/_authenticated/sellers-queue")({
  component: SellersQueuePage,
})

function SellersQueuePage() {
  const { pending, rejected, isLoading, approve, suspend } = useSellers()
  
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; sellerId: string | null }>({
    isOpen: false,
    sellerId: null,
  })
  const [reason, setReason] = useState("")

  const handleApprove = async (id: string) => {
    if (window.confirm("Approve this seller application?")) {
      await approve(id)
    }
  }

  const handleReject = async () => {
    if (!rejectModal.sellerId || !reason.trim()) return
    await suspend({ id: rejectModal.sellerId, reason })
    setRejectModal({ isOpen: false, sellerId: null })
    setReason("")
  }

  if (isLoading) {
    return <div className="p-8">Loading seller queue...</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Seller Applications</h1>
        <p className="text-muted-foreground mt-2">
          Review new applications. Approve to open their shop, or reject with a reason.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          Pending Approval
          <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">{pending.length}</span>
        </h2>
        
        {pending.length === 0 ? (
          <div className="p-8 text-center border border-dashed rounded-xl bg-muted/10 text-muted-foreground">
            No pending applications
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map(seller => (
              <SellerCard 
                key={seller.id} 
                seller={seller}
                onApprove={() => handleApprove(seller.id)}
                onReject={() => setRejectModal({ isOpen: true, sellerId: seller.id })}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Rejected Applications</h2>
        {rejected.length === 0 ? (
          <div className="p-8 text-center border border-dashed rounded-xl bg-muted/10 text-muted-foreground">
            No rejected applications
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
            {rejected.map(seller => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
        )}
      </section>

      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, sellerId: null })}
        title="Reject Application"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectModal({ isOpen: false, sellerId: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!reason.trim()}>Reject</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Provide a reason for rejection.</p>
          <textarea
            className="w-full h-32 p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Reason for rejection..."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}

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
