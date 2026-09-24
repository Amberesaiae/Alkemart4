import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { adminAppeals, type AdminAppeal } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Skeleton, EmptyState, Modal, Textarea } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { isWorkersApi } from "../../lib/config"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/appeals")({
  component: AppealsPage,
})

function AppealsPage() {
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-appeals"],
    queryFn: () => adminAppeals.list(),
  })
  const [resolveTarget, setResolveTarget] = useState<AdminAppeal | null>(null)
  const [decision, setDecision] = useState<"reopen" | "uphold">("reopen")
  const [note, setNote] = useState("")
  const [working, setWorking] = useState(false)

  // Appeals only exist on the Workers cut.
  if (isWorkersApi === false) {
    return (
      <PageShell>
        <PageHeader title="Appeals" description="Seller appeals against rejections." />
        <EmptyState title="Not available" description="Appeals are only supported on the Workers API." />
      </PageShell>
    )
  }

  const appeals = data?.appeals ?? []

  const handleResolve = async () => {
    if (!resolveTarget) return
    setWorking(true)
    try {
      await adminAppeals.resolve(resolveTarget.id, { decision, note: note.trim() || undefined })
      toast.success(decision === "reopen" ? "Listing reopened for review" : "Rejection upheld")
      setResolveTarget(null)
      setNote("")
      qc.invalidateQueries({ queryKey: ["admin-appeals"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve appeal")
    } finally {
      setWorking(false)
    }
  }

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load appeals.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Appeals" description="Seller appeals against rejected listings. Reopen sends the product back for review." />

      <div className="border rounded-lg bg-card">
        <Table label="Open appeals">
          <caption className="sr-only">Open seller appeals</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Appeal</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-56" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : appeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState title="No open appeals" description="Sellers' appeals will appear here." />
                </TableCell>
              </TableRow>
            ) : (
              appeals.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {a.product?.imageUrl ? (
                        <img src={a.product.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted shrink-0" />
                      )}
                      <span className="font-medium">{a.product?.title ?? a.productId.slice(-8)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {a.seller ? `${a.seller.name} (@${a.seller.handle})` : a.sellerId.slice(-8)}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm truncate" title={a.message}>{a.message}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm tabular-nums">
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => { setDecision("reopen"); setNote(""); setResolveTarget(a) }}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Modal
        isOpen={resolveTarget !== null}
        onClose={() => { setResolveTarget(null); setNote("") }}
        title="Resolve appeal"
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => { setResolveTarget(null); setNote("") }} disabled={working}>
              Cancel
            </Button>
            <Button
              variant={decision === "uphold" ? "destructive" : "default"}
              onClick={() => handleResolve()}
              disabled={working}
            >
              {decision === "reopen" ? "Reopen listing" : "Uphold rejection"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Decision">
            {(["reopen", "uphold"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={decision === d}
                onClick={() => setDecision(d)}
                className={`p-3 rounded-lg border-2 text-sm font-bold ${
                  decision === d
                    ? "border-primary bg-muted text-primary"
                    : "border-border hover:border-primary/40 text-muted-foreground"
                }`}
              >
                {d === "reopen" ? "Reopen" : "Uphold"}
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Note to the seller (optional)…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-24"
          />
        </div>
      </Modal>
    </PageShell>
  )
}
