import { createFileRoute, Link } from "@tanstack/react-router"
import { Prohibit } from "@phosphor-icons/react"
import { EmptyState, Button } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"

export const Route = createFileRoute("/_authenticated/unavailable")({
  validateSearch: (search: Record<string, unknown>) => ({
    title: typeof search.title === "string" ? search.title : "Section",
  }),
  component: UnavailablePage,
})

function UnavailablePage() {
  const { title } = Route.useSearch()
  return (
    <PageShell>
      <PageHeader title={title} description="This section of the admin console." />
      <EmptyState
        icon={<Prohibit className="h-8 w-8 opacity-40" />}
        title="Not available on this deployment"
        description="This section hasn't been wired to the Workers API yet. It will appear here automatically once the backend supports it."
      />
      <div className="mt-4">
        <Link to="/analytics">
          <Button variant="outline" size="sm">Back to Analytics</Button>
        </Link>
      </div>
    </PageShell>
  )
}
