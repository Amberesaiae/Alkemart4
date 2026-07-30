import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { adminReturns } from "../../lib/api"
import { EmptyState, Badge, Skeleton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Card, Button } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { RefreshCw, AlertCircle } from "lucide-react"
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

function ReturnsOverviewPage() {
  const [filter, setFilter] = useState("")
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "returns", filter],
    queryFn: () => adminReturns.list(filter ? { status: filter } : undefined),
  })

  const formatGhs = (amount = 0) =>
    new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(amount)

  return (
    <PageShell>
      <PageHeader
        title="Returns"
        description="Marketplace-wide return requests overview."
      />

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.returns.map((ret) => (
                  <TableRow key={ret.id}>
                    <TableCell className="font-black">
                      #{ret.display_id}
                    </TableCell>
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
                    <TableCell className="font-medium">
                      {ret.seller?.name || "-"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {ret.items_count ?? "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {ret.refund_amount != null ? formatGhs(ret.refund_amount / 100) : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {ret.created_at ? format(new Date(ret.created_at), "MMM d, yyyy") : "-"}
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
