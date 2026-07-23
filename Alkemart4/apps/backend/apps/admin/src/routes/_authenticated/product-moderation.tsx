import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useProducts } from "../../hooks/use-products"
import { Button } from "../../components/ui/Button"
import { Badge } from "../../components/ui/Badge"
import { Modal } from "../../components/ui/Modal"

export const Route = createFileRoute("/_authenticated/product-moderation")({
  component: ProductModerationPage,
})

function ProductModerationPage() {
  const { products, isLoading, confirm, reject, requestChanges } = useProducts()
  
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "reject" | "request-changes" | null;
    productId: string | null;
  }>({ isOpen: false, type: null, productId: null })

  const [reason, setReason] = useState("")

  const handleConfirm = async (id: string) => {
    if (window.confirm("Are you sure you want to approve this product?")) {
      await confirm(id)
    }
  }

  const handleAction = async () => {
    if (!modalState.productId || !modalState.type || !reason.trim()) return
    
    try {
      if (modalState.type === "reject") {
        await reject({ id: modalState.productId, reason })
      } else {
        await requestChanges({ id: modalState.productId, reason })
      }
      setModalState({ isOpen: false, type: null, productId: null })
      setReason("")
    } catch (e) {
      alert("Failed to perform action")
    }
  }

  if (isLoading) {
    return <div className="p-8">Loading queue...</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Product Review</h1>
        <p className="text-muted-foreground mt-2">
          Review proposed listings. Approve to publish, request changes, or reject.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="py-20 text-center border rounded-xl bg-card">
          <p className="text-lg font-medium">All caught up</p>
          <p className="text-muted-foreground">No products awaiting review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {products.map((p) => (
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
                    <Badge variant={p.quality_score > 80 ? "success" : "warning"}>
                      Quality: {p.quality_score}
                    </Badge>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Submitted: {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex sm:flex-col gap-2 justify-end shrink-0 sm:w-40">
                <Button className="w-full" onClick={() => handleConfirm(p.id)}>
                  Approve
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setModalState({ isOpen: true, type: "request-changes", productId: p.id })}
                >
                  Request Changes
                </Button>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={() => setModalState({ isOpen: true, type: "reject", productId: p.id })}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, type: null, productId: null })}
        title={modalState.type === "reject" ? "Reject Product" : "Request Changes"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalState({ isOpen: false, type: null, productId: null })}>
              Cancel
            </Button>
            <Button 
              variant={modalState.type === "reject" ? "destructive" : "default"} 
              onClick={handleAction}
              disabled={!reason.trim()}
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {modalState.type === "reject" 
              ? "Provide a reason for rejecting this product. This will be sent to the seller."
              : "What changes does the seller need to make before this can be approved?"}
          </p>
          <textarea
            className="w-full h-32 p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Enter reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  )
}
