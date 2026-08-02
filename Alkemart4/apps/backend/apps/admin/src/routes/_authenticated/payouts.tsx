import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminPayouts, adminSellers, type AdminPayout } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Skeleton, EmptyState, Modal, Input, Select } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Send } from "lucide-react"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/payouts")({
  component: PayoutsPage,
})

function StatusBadge({ status }: { status?: string }) {
  let variant: "default" | "secondary" | "destructive" | "success" | "warning" = "secondary"
  switch ((status ?? "").toLowerCase()) {
    case "paid": variant = "success"; break
    case "processing": variant = "warning"; break
    case "failed": variant = "destructive"; break
    case "pending": variant = "default"; break
    case "canceled": variant = "secondary"; break
  }
  return <Badge variant={variant} className="capitalize">{status}</Badge>
}

function TriggerPayoutDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [sellerId, setSellerId] = useState("")
  const [amountGhs, setAmountGhs] = useState("")
  const [note, setNote] = useState("")

  const { data: sellersData, isLoading: sellersLoading } = useQuery({
    queryKey: ["admin-sellers-payout-picker"],
    queryFn: () => adminSellers.list({ limit: 200 }),
    enabled: isOpen,
  })

  const trigger = useMutation({
    mutationFn: () =>
      adminPayouts.trigger({
        seller_id: sellerId,
        amount: parseFloat(amountGhs),
        currency_code: "ghs",
        note: note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payouts"] })
      toast.success("Payout triggered successfully")
      onClose()
      setSellerId("")
      setAmountGhs("")
      setNote("")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to trigger payout"),
  })

  const selectedSeller = sellersData?.sellers?.find(s => s.id === sellerId)
  const amount = parseFloat(amountGhs)
  const isValid = !!sellerId && !isNaN(amount) && amount > 0

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-5">
        <h3 className="text-lg font-semibold">Trigger Payout</h3>
        <p className="text-sm text-muted-foreground">
          This will initiate a Paystack transfer directly to the seller's registered MoMo account.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Seller</label>
            <Select
              value={sellerId}
              onChange={e => setSellerId(e.target.value)}
              className="mt-1"
            >
              <option value="">Select seller…</option>
              {sellersLoading ? (
                <option disabled>Loading…</option>
              ) : (
                sellersData?.sellers?.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (@{s.handle})</option>
                ))
              )}
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Amount (GHS)</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">GH₵</span>
              <Input
                type="number"
                className="pl-12"
                placeholder="0.00"
                value={amountGhs}
                onChange={e => setAmountGhs(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Note (optional)</label>
            <Input
              className="mt-1"
              placeholder="e.g. October commission settlement"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        {selectedSeller && isValid && (
          <div className="bg-muted/30 rounded-xl p-4 text-sm space-y-1 border">
            <p className="font-bold">Confirmation</p>
            <p>Seller: <strong>{selectedSeller.name}</strong></p>
            <p>Amount: <strong>GH₵ {amount.toFixed(2)}</strong></p>
            {note && <p>Note: {note}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!isValid}
            isLoading={trigger.isPending}
            onClick={() => trigger.mutate()}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Send Payout
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function PayoutsPage() {
  const [offset, setOffset] = useState(0)
  const [showTrigger, setShowTrigger] = useState(false)
  const limit = 50

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["payouts", offset],
    queryFn: () => adminPayouts.list({ offset, limit }),
  })

  const payouts = data?.payouts || []

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount)

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load payouts.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <PageHeader title="Payouts" description="Platform payouts to sellers." />
        <Button className="gap-2" onClick={() => setShowTrigger(true)}>
          <Send className="h-4 w-4" />
          Trigger Payout
        </Button>
      </div>

      <div className="border rounded-xl bg-card">
        <Table>
          <caption className="sr-only">Payouts list</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Payout</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                </TableRow>
              ))
            ) : payouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState title="No payouts yet" description="Payouts will appear once orders are captured." />
                </TableCell>
              </TableRow>
            ) : (
              payouts.map((p: AdminPayout) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">#{p.display_id}</TableCell>
                  <TableCell className="font-medium">{formatAmount(Number(p.amount), p.currency_code)}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {payouts.length ? `${offset + 1}–${offset + payouts.length}` : "0"} of {data?.count ?? "…"}
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

      <TriggerPayoutDialog isOpen={showTrigger} onClose={() => setShowTrigger(false)} />
    </PageShell>
  )
}
