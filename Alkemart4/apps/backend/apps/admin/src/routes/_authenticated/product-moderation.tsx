import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Flag } from "@phosphor-icons/react"
import { useProducts } from "../../hooks/use-products"
import { moderation, type AdminProductDetail, type ProposedProduct } from "../../lib/api"
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
  const [detailId, setDetailId] = useState<string | null>(null)
  const detailQ = useQuery({
    queryKey: ["product-detail", detailId],
    queryFn: () => moderation.getProduct(detailId as string),
    enabled: detailId !== null,
    staleTime: 30_000,
  })

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
      setDetailId(null)
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
      setDetailId(null)
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
            <div key={i} className="flex flex-col sm:flex-row gap-6 p-6 border rounded-lg bg-card">
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
              <div key={p.id} className="flex flex-col sm:flex-row gap-6 p-6 border rounded-lg bg-card shadow-sm">
                <Checkbox
                  checked={selected.includes(p.id)}
                  onCheckedChange={() => toggleOne(p.id)}
                  aria-label={`Select ${p.title || "product"} for bulk action`}
                  className="mt-1 shrink-0"
                />
              <button
                type="button"
                onClick={() => setDetailId(p.id)}
                className="h-32 w-32 shrink-0 rounded-lg overflow-hidden bg-muted border flex items-center justify-center hover:border-primary/60"
                aria-label={`Review ${p.title || "product"} details`}
              >
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-muted-foreground text-sm">No Image</span>
                )}
              </button>

              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <button type="button" onClick={() => setDetailId(p.id)} className="text-left hover:underline">
                      <h3 className="font-semibold text-lg">{p.title}</h3>
                    </button>
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
                      <Badge key={f.rule} variant="warning" className="gap-1 text-xs font-semibold">
                        <Flag size={12} weight="fill" aria-hidden /> {f.message}
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
              className="sticky bottom-4 mt-4 flex items-center gap-3 rounded-lg border bg-card p-4 shadow-md"
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

      <ProductDetailDrawer
        productId={detailId}
        detail={detailQ.data ?? null}
        isLoading={detailQ.isLoading}
        isError={detailQ.isError}
        onClose={() => setDetailId(null)}
        onApprove={(id) => setConfirmModal({ isOpen: true, productId: id })}
        onDecide={(id, type) => setModalState({ isOpen: true, type, productId: id })}
      />

      <ConfirmDialog
        open={confirmModal.isOpen}        onOpenChange={(open) => setConfirmModal({ isOpen: open, productId: open ? confirmModal.productId : null })}
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

function ghs(pesewas: string): string {
  const n = Number(pesewas)
  return Number.isFinite(n) ? `GH₵ ${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"
}

/**
 * Review drawer: full listing incl. variant matrix, so moderators approve
 * combinations — not just the base product. Read-only; actions reuse the
 * queue modals (drawer closes on decision).
 */
function ProductDetailDrawer({ productId, detail, isLoading, isError, onClose, onApprove, onDecide }: {
  productId: string | null
  detail: AdminProductDetail | null
  isLoading: boolean
  isError: boolean
  onClose: () => void
  onApprove: (id: string) => void
  onDecide: (id: string, type: "reject" | "request-changes") => void
}) {
  if (productId === null) return null
  const combos = detail?.variants ?? []
  const options = detail?.options ?? []
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Product review details">
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 bg-black/50 cursor-default" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col gap-4 overflow-y-auto border-l bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Review listing</p>
            <h2 className="text-xl font-bold">{detail?.product.title ?? "Loading…"}</h2>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : null}
        {isError || (!isLoading && !detail) ? (
          <p className="text-sm text-destructive font-medium">Could not load this listing. Close and try again.</p>
        ) : null}

        {detail ? (
          <>
            <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
              {detail.product.imageUrl ? (
                <img src={detail.product.imageUrl} alt={detail.product.title} className="h-full w-full object-cover" />
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No photo</p>
              )}
            </div>
            {detail.product.description ? (
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{detail.product.description}</p>
            ) : null}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</dt>
                <dd className="font-semibold">{detail.product.status}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Base price</dt>
                <dd className="font-semibold tabular-nums">{ghs(detail.offer.pricePesewas)} · {detail.offer.onHand} in stock</dd>
              </div>
            </dl>

            {options.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-bold">Options</h3>
                <ul className="space-y-1.5">
                  {options.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{o.name}:</span>
                      {o.values.map((v) => (
                        <span key={v.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
                          {v.imageUrl ? <img src={v.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" /> : null}
                          {v.value}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="space-y-2">
              <h3 className="text-sm font-bold">
                Combinations{combos.length > 0 ? ` (${combos.length})` : ""}
              </h3>
              {combos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Single listing — no combinations.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-bold">Combo</th>
                        <th className="px-3 py-2 font-bold text-right">Price</th>
                        <th className="px-3 py-2 font-bold text-right">Stock</th>
                        <th className="px-3 py-2 font-bold text-right">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combos.map((c) => (
                        <tr key={c.variant.id} className="border-t">
                          <td className="px-3 py-2 font-medium">
                            {Object.values(c.options).join(" / ") || "Standard"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{ghs(c.offer.pricePesewas)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.offer.onHand}</td>
                          <td className="px-3 py-2 text-right">
                            <Badge variant={c.offer.active ? "success" : "secondary"}>
                              {c.offer.active ? "Live" : "Off"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="mt-auto flex gap-2 border-t pt-4">
              <Button className="flex-1" onClick={() => onApprove(detail.product.id)}>Approve</Button>
              <Button variant="outline" className="flex-1" onClick={() => onDecide(detail.product.id, "request-changes")}>
                Request changes
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => onDecide(detail.product.id, "reject")}>
                Reject
              </Button>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  )
}
