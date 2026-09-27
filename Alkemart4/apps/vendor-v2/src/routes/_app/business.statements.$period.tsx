import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { ErrorState } from "@workspace/console-ui/components/console/states"
import { StatementView } from "@workspace/console-ui/components/console/statement-view"
import { downloadStatement, getStatement } from "@/lib/business"
import { useSeller } from "@/lib/queries"

export const Route = createFileRoute("/_app/business/statements/$period")({ component: StatementPage })

function StatementPage() {
  const { period } = Route.useParams()
  const seller = useSeller()
  const q = useQuery({ queryKey: ["statement", period], queryFn: () => getStatement(period) })
  const [downloading, setDownloading] = useState(false)
  return (
    <div className="space-y-5">
      <Link to="/business" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-muted-foreground hover:text-foreground print:hidden">
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" aria-hidden />
        Business
      </Link>
      {q.isPending ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="This statement didn't load" error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <StatementView
          statement={q.data}
          title={seller.data?.name ?? "Your shop"}
          downloading={downloading}
          onDownload={async () => {
            setDownloading(true)
            try {
              await downloadStatement(period)
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't download.")
            } finally {
              setDownloading(false)
            }
          }}
        />
      )}
    </div>
  )
}
