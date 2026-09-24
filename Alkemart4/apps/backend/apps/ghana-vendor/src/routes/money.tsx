import { createFileRoute } from "@tanstack/react-router"
import { usePayoutStatement } from "../lib/hooks"
import { Card, Badge, Button, Skeleton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@workspace/ui"
import { format } from "date-fns"
import { CurrencyCircleDollar, WarningCircle } from "@phosphor-icons/react"
import { PageShell } from "../components/page-shell"
import { PageHeader } from "../components/page-header"

export const Route = createFileRoute('/money')({
  component: MoneyPage,
})

const formatGhs = (pesewas: string) =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(pesewas) / 100)

function stateBadge(state: string) {
  if (state === "paid") return <Badge variant="success">Paid</Badge>
  if (state === "held") return <Badge variant="warning">Held</Badge>
  return <Badge variant="secondary">Pending</Badge>
}

/**
 * Money tab (Phase 4D): delivered-order earnings with holds and reasons.
 * All math arrives from the statement endpoint in pesewas integers — the
 * page formats, never computes.
 */
function MoneyPage() {
  const { data, isLoading, isError, refetch, isFetching } = usePayoutStatement()
  const totals = data?.totals
  const lines = data?.lines ?? []
  const holds = data?.holds ?? []

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Money"
          description="Delivered-order earnings, holds with reasons, and payout history."
        />
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl shrink-0"
          disabled={isFetching}
          onClick={() => { void refetch() }}
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading money">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : null}
      {isError ? (
        <Card className="p-6 text-sm text-destructive">
          Could not load your statement. Check your connection and refresh.
        </Card>
      ) : null}
      {data ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-5 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending payout</p>
              <p className="text-2xl font-bold tabular-nums">{formatGhs(totals?.pendingNetPesewas ?? "0")}</p>
              <p className="text-xs text-muted-foreground">Delivered, unpaid, unheld</p>
            </Card>
            <Card className="p-5 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">On hold</p>
              <p className="text-2xl font-bold tabular-nums">{formatGhs(totals?.heldNetPesewas ?? "0")}</p>
              <p className="text-xs text-muted-foreground">Frozen with a reason below</p>
            </Card>
            <Card className="p-5 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Paid out</p>
              <p className="text-2xl font-bold tabular-nums">{formatGhs(totals?.paidNetPesewas ?? "0")}</p>
              <p className="text-xs text-muted-foreground">
                Net of {(data.commissionBps / 100).toFixed(1)}% commission
              </p>
            </Card>
          </div>

          {holds.length > 0 ? (
            <Card className="p-5 space-y-3 border-warning/40">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <WarningCircle className="h-4 w-4 text-warning" /> Active holds
              </h2>
              <ul className="space-y-2">
                {holds.map((h) => (
                  <li key={h.id} className="text-sm">
                    <span className="font-bold">{h.orderId ? `Order ${h.orderId.slice(0, 8)}…` : "Whole balance"}</span>
                    <span className="text-muted-foreground"> — {h.reason}</span>
                    <span className="block text-xs text-muted-foreground">
                      Since {format(new Date(h.createdAt), "d MMM yyyy")}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Holds release when the review behind them closes. Contact support with the reason above.
              </p>
            </Card>
          ) : null}

          <Card className="p-0 overflow-hidden">
            <div className="p-5 pb-3 flex items-center gap-2">
              <CurrencyCircleDollar className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-base">Statement lines</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground tabular-nums">
                {totals?.lineCount ?? 0}
              </span>
            </div>
            {lines.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                No delivered orders yet. Earnings appear here after delivery.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => (
                      <TableRow key={l.orderId}>
                        <TableCell className="font-mono text-xs">{l.orderId.slice(0, 8)}…</TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {l.orderedAt ? format(new Date(l.orderedAt), "d MMM yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatGhs(l.subtotalPesewas)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatGhs(l.commissionPesewas)}
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{formatGhs(l.netPesewas)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            {stateBadge(l.state)}
                            {l.holdReason ? (
                              <span className="text-xs text-muted-foreground max-w-40">{l.holdReason}</span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </PageShell>
  )
}
