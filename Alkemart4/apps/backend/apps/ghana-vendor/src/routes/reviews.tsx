import { createFileRoute } from "@tanstack/react-router"
import { Card } from "@workspace/ui"
import { PageShell } from "../components/page-shell"
import { PageHeader } from "../components/page-header"
import { Star } from "@phosphor-icons/react"

export const Route = createFileRoute('/reviews')({
  component: ReviewsPage,
})

/**
 * Reserved skeleton — buyer-written reviews + vendor responses ship as a
 * separate project. No dead controls: nothing here pretends to work.
 */
function ReviewsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Reviews"
        description="What buyers say about your shop."
      />
      <Card className="p-8 text-center space-y-3">
        <Star className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-bold">Reviews are coming</h2>
        <p className="text-sm text-muted-foreground font-medium max-w-md mx-auto">
          Buyer-written reviews and your replies aren&apos;t available yet. When they
          land, you&apos;ll see ratings, review threads, and moderation here.
        </p>
      </Card>
    </PageShell>
  )
}
