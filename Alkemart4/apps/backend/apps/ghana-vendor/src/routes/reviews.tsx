import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useVendorReviews, useRespondReview } from "../lib/hooks"
import type { VendorReview } from "../lib/api"
import { Card, Button, Textarea, Skeleton, Label } from "@workspace/ui"
import { PageShell } from "../components/page-shell"
import { PageHeader } from "../components/page-header"
import { Star, ChatCircleText } from "@phosphor-icons/react"
import { toast } from "sonner"

export const Route = createFileRoute('/reviews')({
  component: ReviewsPage,
})

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="font-bold text-primary tabular-nums">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  )
}

function statusLabel(status: VendorReview["status"]) {
  return status === "published" ? "Published" : status === "hidden" ? "Hidden by ops" : "In review"
}

function ReviewCard({ review }: { review: VendorReview }) {
  const respond = useRespondReview()
  const [replyOpen, setReplyOpen] = useState(false)
  const [message, setMessage] = useState("")

  const handleReply = async () => {
    if (!message.trim()) {
      toast.error("Write a reply first.")
      return
    }
    try {
      await respond.mutateAsync({ id: review.id, message: message.trim() })
      toast.success("Reply posted.")
      setMessage("")
      setReplyOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post reply.")
    }
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Stars rating={review.rating} />
        <span className="ml-auto text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {statusLabel(review.status)}
        </span>
      </div>
      {review.title && <h3 className="font-bold">{review.title}</h3>}
      <p className="text-sm">{review.body}</p>
      <p className="text-xs text-muted-foreground font-medium">
        {new Date(review.createdAt).toLocaleDateString()}
      </p>
      {review.vendorResponse ? (
        <div className="rounded-xl bg-muted/40 border p-3 text-sm">
          <p className="font-bold flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground mb-1">
            <ChatCircleText className="h-4 w-4" /> Your reply
          </p>
          <p>{review.vendorResponse}</p>
        </div>
      ) : replyOpen ? (
        <div className="space-y-2">
          <Label htmlFor={`reply-${review.id}`}>Reply publicly</Label>
          <Textarea
            id={`reply-${review.id}`}
            value={message}
            rows={3}
            maxLength={2001}
            placeholder="Thank them, or address the issue…"
            onChange={(e) => setMessage(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { void handleReply() }} isLoading={respond.isPending}>
              Post reply
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setReplyOpen(false); setMessage("") }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setReplyOpen(true)}>
          <ChatCircleText className="h-4 w-4" /> Reply
        </Button>
      )}
    </Card>
  )
}

function ReviewsPage() {
  const { data, isLoading, isError, refetch } = useVendorReviews()
  const reviews = data?.reviews ?? []

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Reviews" description="What buyers say about your shop." />
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      </PageShell>
    )
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
      <PageHeader
        title="Reviews"
        description="Verified-purchase reviews from your buyers. New reviews go through ops before publishing — reply to any review."
      />
      {reviews.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <Star className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-bold">No reviews yet</h2>
          <p className="text-sm text-muted-foreground font-medium max-w-md mx-auto">
            Reviews appear here after buyers rate delivered orders. Replies show publicly under the review.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </PageShell>
  )
}
