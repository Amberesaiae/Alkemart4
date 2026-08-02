import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useReturns, useReturnReasons, useReceiveReturnItems, useConfirmReceiveReturn, useDismissReturnItems, useRefundPayment } from "../lib/hooks"
import type { Return, ReturnItem } from "../lib/api"
import { Card, Button, Badge, Skeleton, Input, Label } from "@workspace/ui"
import { format } from "date-fns"
import { RefreshCw, Package, CheckCircle2, XCircle, Banknote } from "lucide-react"
import { PageShell } from "../components/page-shell"
import { PageHeader } from "../components/page-header"
import { toast } from "sonner"

export const Route = createFileRoute('/returns')({
  component: ReturnsPage,
})

/** Simple inline dialog rendered below the return card. */
function InlineDialog({
  title,
  description,
  onConfirm,
  onCancel,
  isPending,
  confirmLabel = "Confirm",
  variant = "default",
  children,
}: {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
  confirmLabel?: string
  variant?: "default" | "destructive"
  children?: React.ReactNode
}) {
  return (
    <div className="mt-4 p-4 rounded-xl border border-border bg-muted/30 space-y-3">
      <div>
        <p className="font-bold text-sm">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={variant === "destructive" ? "destructive" : "default"}
          isLoading={isPending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function ReturnsPage() {
  const [filter, setFilter] = useState("all")
  const params = filter === "all" ? undefined : { status: filter }
  const { data, isLoading, isError, refetch } = useReturns(params)
  const reasonsQ = useReturnReasons()

  const receiveItems = useReceiveReturnItems()
  const confirmReceive = useConfirmReceiveReturn()
  const dismissItems = useDismissReturnItems()
  const refund = useRefundPayment()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [declineReturnId, setDeclineReturnId] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState("")

  const tabs = [
    { id: "all", label: "All" },
    { id: "requested", label: "Requested" },
    { id: "received", label: "Received" },
    { id: "canceled", label: "Canceled" },
  ]

  const formatGhs = (amount = 0) =>
    new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(amount)

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "warning" | "success" | "default" | "destructive"; label: string }> = {
      requested: { variant: "warning", label: "Requested" },
      open: { variant: "warning", label: "Open" },
      received: { variant: "success", label: "Received" },
      partially_received: { variant: "default", label: "Partial" },
      canceled: { variant: "destructive", label: "Canceled" },
    }
    const s = map[status] || { variant: "default", label: status }
    return <Badge variant={s.variant as "warning" | "success" | "default" | "destructive"}>{s.label}</Badge>
  }

  const handleReceive = async (ret: Return) => {
    try {
      await receiveItems.mutateAsync({
        returnId: ret.id,
        items: ret.items.map((i: ReturnItem) => ({ id: i.id, quantity: i.quantity })),
      })
      toast.success("Return items received.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to receive items")
    }
  }

  const handleConfirm = async (ret: Return) => {
    try {
      await confirmReceive.mutateAsync({ returnId: ret.id })
      toast.success("Return confirmed.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to confirm receive")
    }
  }

  const handleDismiss = async (ret: Return) => {
    const reason = declineReason.trim() || "Declined by seller"
    try {
      await dismissItems.mutateAsync({
        returnId: ret.id,
        items: ret.items.map((i: ReturnItem) => ({ id: i.id, quantity: 0, internal_note: reason })),
      })
      toast.success("Return declined.")
      setDeclineReturnId(null)
      setDeclineReason("")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to decline return")
    }
  }

  const handleRefund = async (ret: Return) => {
    if (!ret.payment_id) return
    try {
      await refund.mutateAsync({ paymentId: ret.payment_id, amount: ret.refund_amount || undefined })
      toast.success(`Refund of ${formatGhs((ret.refund_amount || 0) / 100)} processed.`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to process refund")
    }
  }

  return (
    <PageShell>
      <PageHeader title="Returns" description="Manage return requests from customers." />

      <div className="flex overflow-x-auto pb-2 scrollbar-none gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border-2 ${
              filter === tab.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-transparent hover:border-border hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card className="p-8 text-center border-2 border-destructive/20">
          <p className="text-destructive font-bold">Failed to load returns</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      ) : !data?.returns || data.returns.length === 0 ? (
        <Card className="p-16 text-center border-2 border-dashed">
          <RefreshCw className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h2 className="text-lg font-bold mb-1">No returns</h2>
          <p className="text-sm text-muted-foreground">No return requests match your current filter.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.returns.map((ret: Return) => (
            <Card key={ret.id} className="border-2 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <RefreshCw className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black">Return #{ret.display_id}</span>
                      {statusBadge(ret.status)}
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      Order #{ret.order_id?.slice(-6)} · {ret.items.length} item{ret.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    {ret.created_at ? format(new Date(ret.created_at), "MMM d, yyyy") : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(expandedId === ret.id ? null : ret.id)}
                  >
                    {expandedId === ret.id ? "Hide" : "View"}
                  </Button>
                </div>
              </div>

              {expandedId === ret.id && (
                <div className="mt-4 pt-4 border-t border-border space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold">Items</h3>
                    {ret.items.map((item: ReturnItem) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 text-sm">
                        <div>
                          <span className="font-medium">{item.item_id.slice(0, 8)}…</span>
                          <span className="text-muted-foreground ml-2">
                            Qty: {item.quantity} / Received: {item.received_quantity}
                          </span>
                        </div>
                        {item.reason_id && (
                          <span className="text-xs text-muted-foreground">
                            {reasonsQ.data?.return_reasons?.find((r: { id: string; label: string }) => r.id === item.reason_id)?.label || item.reason_id}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {(ret.status === "requested" || ret.status === "open") && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleReceive(ret)}
                        isLoading={receiveItems.isPending}
                      >
                        <Package className="h-4 w-4 mr-1" />
                        Receive Items
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConfirm(ret)}
                        isLoading={confirmReceive.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Confirm Received
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => {
                          setDeclineReturnId(declineReturnId === ret.id ? null : ret.id)
                          setDeclineReason("")
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                      {ret.refund_amount != null && ret.payment_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRefund(ret)}
                          isLoading={refund.isPending}
                        >
                          <Banknote className="h-4 w-4 mr-1" />
                          Refund {formatGhs(ret.refund_amount / 100)}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Decline dialog — inline below the buttons */}
                  {declineReturnId === ret.id && (
                    <InlineDialog
                      title="Decline return request"
                      description="Provide a reason for the customer. Required."
                      onConfirm={() => handleDismiss(ret)}
                      onCancel={() => { setDeclineReturnId(null); setDeclineReason("") }}
                      isPending={dismissItems.isPending}
                      confirmLabel="Decline Return"
                      variant="destructive"
                    >
                      <div className="space-y-1">
                        <Label htmlFor={`decline-reason-${ret.id}`} className="text-xs">Reason</Label>
                        <Input
                          id={`decline-reason-${ret.id}`}
                          value={declineReason}
                          onChange={e => setDeclineReason(e.target.value)}
                          placeholder="e.g. Item is not in original condition"
                          autoFocus
                        />
                      </div>
                    </InlineDialog>
                  )}

                  {ret.status === "received" && (
                    <Button
                      size="sm"
                      onClick={() => handleConfirm(ret)}
                      isLoading={confirmReceive.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Confirm Receive (Finalize)
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  )
}
