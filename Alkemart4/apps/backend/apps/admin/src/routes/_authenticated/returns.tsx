import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useAdminReturns, useAdminReturnDetail, useReturnActions } from "../../hooks/use-returns-admin"
import type { AdminReturn } from "../../lib/api"
import { EmptyState, Badge, Skeleton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Card, Button, Textarea, Modal } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { RefreshCw, AlertCircle, CheckCircle2, XCircle, Banknote, ArrowLeft } from "lucide-react"
import { format } from "date-fns"

export const Route = createFileRoute("/_authenticated/returns")({
  component: ReturnsOverviewPage,
})

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Requested", value: "requested" },
  { label: "Received", value: "received" },
  { label: "Canceled", value: "canceled" },
]

function ReturnDetailPane({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading } = useAdminReturnDetail(id)
  const actions = useReturnActions()

  const [approveModal, setApproveModal] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [refundModal, setRefundModal] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [approveNote, setApproveNote] = useState("")

  const ret = data?.return
  const formatGhs = (n = 0) => new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n)

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!ret) {
    return <div className="p-6 text-destructive text-sm">Failed to load return details.</div>
  }

  const isOpen = ret.status === "requested" || ret.status === "open"
  const isReceived = ret.status === "received"
  const canRefund = isReceived && ret.refund_amount != null && ret.refund_amount > 0
  const isDisputed = (ret.metadata as Record<string, unknown> | undefined)?.is_disputed === true

  return (
    <div className="space-y-6">
      <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to list
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            Return #{ret.display_id}
            <Badge variant={ret.status === "received" ? "success" : ret.status === "canceled" ? "destructive" : "warning"} className="capitalize">
              {ret.status}
            </Badge>
            {isDisputed && <Badge variant="destructive">Disputed</Badge>}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Order: {ret.order?.display_id ? `#${ret.order.display_id}` : ret.order_id?.slice(-8)} ·{" "}
            {ret.created_at ? format(new Date(ret.created_at), "MMM d, yyyy") : "-"}
          </p>
        </div>
      </div>

      {ret.order && (
        <Card className="p-4 space-y-2">
          <h3 className="text-sm font-bold">Order Summary</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p>Customer: {ret.order.customer?.first_name} {ret.order.customer?.last_name} ({ret.order.customer?.email})</p>
            <p>Order Total: {formatGhs((ret.order.total || 0) / 100)}</p>
            {ret.refund_amount != null && (
              <p className="text-foreground font-semibold">Refund Amount: {formatGhs(ret.refund_amount / 100)}</p>
            )}
          </div>
        </Card>
      )}

      {ret.items && ret.items.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-bold mb-3">Return Items</h3>
          <div className="space-y-2">
            {ret.items.map(item => (
              <div key={item.id} className="flex justify-between text-sm p-2 bg-muted/30 rounded-lg">
                <span className="font-mono text-xs">{item.item_id.slice(-8)}</span>
                <span className="text-muted-foreground">Qty: {item.quantity} / Recv: {item.received_quantity}</span>
                {item.note && <span className="text-muted-foreground italic text-xs">{item.note}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {(isOpen || isReceived || canRefund) && (
        <div className="flex flex-wrap gap-2">
          {isOpen && (
            <>
              <Button size="sm" className="gap-1" onClick={() => setApproveModal(true)}>
                <CheckCircle2 className="h-4 w-4" />
                Approve Return
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30 gap-1"
                onClick={() => setRejectModal(true)}
              >
                <XCircle className="h-4 w-4" />
                Reject Return
              </Button>
            </>
          )}
          {canRefund && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setRefundModal(true)}>
              <Banknote className="h-4 w-4" />
              Refund {formatGhs((ret.refund_amount || 0) / 100)}
            </Button>
          )}
        </div>
      )}

      {/* Approve modal */}
      <Modal isOpen={approveModal} onClose={() => setApproveModal(false)}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Approve Return</h3>
          <p className="text-sm text-muted-foreground">Mark this return as received. The buyer will be notified.</p>
          <Textarea placeholder="Optional note…" value={approveNote} onChange={e => setApproveNote(e.target.value)} className="h-20" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setApproveModal(false)}>Cancel</Button>
            <Button
              isLoading={actions.approve.isPending}
              onClick={async () => {
                await actions.approve.mutateAsync({ id: ret.id, note: approveNote || undefined })
                setApproveModal(false)
              }}
            >
              Approve
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal isOpen={rejectModal} onClose={() => setRejectModal(false)}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Reject Return</h3>
          <p className="text-sm text-muted-foreground">Provide a reason. The buyer will be notified via SMS.</p>
          <Textarea
            placeholder="Reason for rejection…"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            className="h-24"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectModal(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              isLoading={actions.reject.isPending}
              onClick={async () => {
                await actions.reject.mutateAsync({ id: ret.id, reason: rejectReason })
                setRejectModal(false)
                setRejectReason("")
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>

      {/* Refund modal */}
      <Modal isOpen={refundModal} onClose={() => setRefundModal(false)}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Process Refund</h3>
          <p className="text-sm text-muted-foreground">
            This will trigger a Paystack refund of <strong>{formatGhs((ret.refund_amount || 0) / 100)}</strong> to the buyer's original payment method.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRefundModal(false)}>Cancel</Button>
            <Button
              isLoading={actions.refund.isPending}
              onClick={async () => {
                await actions.refund.mutateAsync(ret.id)
                setRefundModal(false)
              }}
            >
              Confirm Refund
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ReturnsOverviewPage() {
  const [filter, setFilter] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useAdminReturns(filter ? { status: filter } : undefined)

  const formatGhs = (amount = 0) =>
    new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(amount)

  if (selectedId) {
    return (
      <PageShell>
        <ReturnDetailPane id={selectedId} onBack={() => setSelectedId(null)} />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Returns" description="Marketplace-wide return requests overview." />

      <div className="flex overflow-x-auto pb-2 scrollbar-none gap-2">
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab.value || "all"}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border-2 ${
              filter === tab.value
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-transparent hover:border-border hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card className="border-2">
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : isError ? (
        <Card className="p-8 text-center border-2 border-destructive/20">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-bold mb-1">Failed to load returns</h2>
          <p className="text-muted-foreground text-sm mb-4">Something went wrong.</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </Card>
      ) : !data?.returns || data.returns.length === 0 ? (
        <EmptyState
          icon={<RefreshCw className="h-8 w-8 opacity-40" />}
          title="No returns found"
          description="There are no return requests matching your filter."
        />
      ) : (
        <Card className="border-2 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Refund</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.returns.map((ret: AdminReturn) => (
                  <TableRow key={ret.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-black">#{ret.display_id}</TableCell>
                    <TableCell>
                      <Badge variant={
                        ret.status === "requested" ? "warning" :
                        ret.status === "received" ? "success" :
                        ret.status === "canceled" ? "destructive" :
                        "default"
                      }>
                        {ret.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{ret.seller?.name || "-"}</TableCell>
                    <TableCell className="tabular-nums">{ret.items_count ?? "-"}</TableCell>
                    <TableCell className="font-medium">
                      {ret.refund_amount != null ? formatGhs(ret.refund_amount / 100) : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {ret.created_at ? format(new Date(ret.created_at), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(ret.id)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </PageShell>
  )
}
