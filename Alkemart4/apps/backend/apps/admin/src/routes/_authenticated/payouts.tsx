import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { adminPayouts, type AdminPayout } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Skeleton, EmptyState } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"

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

function PayoutsPage() {
  const [offset, setOffset] = useState(0)
  const limit = 50

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["payouts", offset],
    queryFn: () => adminPayouts.list({ offset, limit }),
  })

  const payouts = data?.payouts || []

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

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount)

  return (
    <PageShell>
      <PageHeader title="Payouts" description="Platform payouts to sellers." />

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
          <Button variant="outline" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
            Previous
          </Button>
          <Button variant="outline" disabled={!data?.count || offset + limit >= (data?.count || 0)} onClick={() => setOffset((o) => o + limit)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  )
}
