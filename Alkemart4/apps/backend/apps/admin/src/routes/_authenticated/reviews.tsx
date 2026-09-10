import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { adminReviews, type AdminReview } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Skeleton, EmptyState, Modal } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { isWorkersApi } from "../../lib/config"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/reviews")({
  component: ReviewsPage,
})

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="font-bold text-primary tabular-nums">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  )
}

function ReviewsPage() {
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => adminReviews.list(),
  })
  const [target, setTarget] = useState<AdminReview | null>(null)
  const [working, setWorking] = useState(false)

  if (isWorkersApi === false) {
    return (
      <PageShell>
        <PageHeader title="Reviews" description="Buyer-written reviews awaiting moderation." />
        <EmptyState title="Not available" description="Reviews are only supported on the Workers API." />
      </PageShell>
    )
  }

  const reviews = data?.reviews ?? []

  const handleModerate = async (action: "publish" | "hide") => {
    if (!target) return
    setWorking(true)
    try {
      await adminReviews.moderate(target.id, action)
      toast.success(action === "publish" ? "Review published" : "Review hidden")
      setTarget(null)
      qc.invalidateQueries({ queryKey: ["admin-reviews"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to moderate review")
    } finally {
      setWorking(false)
    }
  }

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load reviews.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Reviews" description="Buyer reviews awaiting moderation. Publish to show them, hide to suppress." />

      <div className="border rounded-xl bg-card">
        <Table label="Pending reviews">
          <caption className="sr-only">Reviews awaiting moderation</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Rating</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : reviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState title="No pending reviews" description="New buyer reviews will appear here for moderation." />
                </TableCell>
              </TableRow>
            ) : (
              reviews.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Stars rating={r.rating} /></TableCell>
                  <TableCell>
                    <p className="font-semibold text-sm">{r.title || "Untitled"}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2 max-w-md">{r.body}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.seller ? <>{r.seller.name} <span className="block text-xs text-muted-foreground font-mono">@{r.seller.handle}</span></> : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm tabular-nums">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => setTarget(r)}>Review</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Modal isOpen={!!target} onClose={() => setTarget(null)}>
        {target && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Moderate review</h3>
            <div className="rounded-xl border p-4 space-y-2 bg-muted/30">
              <Stars rating={target.rating} />
              {target.title && <p className="font-bold">{target.title}</p>}
              <p className="text-sm">{target.body}</p>
              <p className="text-xs text-muted-foreground">by {target.buyerEmail}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
              <Button variant="destructive" disabled={working} isLoading={working} onClick={() => { void handleModerate("hide") }}>
                Hide
              </Button>
              <Button disabled={working} isLoading={working} onClick={() => { void handleModerate("publish") }}>
                Publish
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  )
}
