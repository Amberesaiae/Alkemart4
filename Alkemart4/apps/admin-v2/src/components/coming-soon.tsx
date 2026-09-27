import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { EmptyState } from "@workspace/console-ui/components/console/states"

/** Development placeholder while admin-v2 is built phase by phase (CONSOLE-REDESIGN §7). */
export function ComingSoon({ title, description, phase }: { title: string; description: string; phase: number }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        title={`Being rebuilt — phase ${phase}`}
        description="This screen is next in the admin-v2 rebuild. The current admin app still handles it."
        className="rounded-2xl border bg-card"
      />
    </div>
  )
}
