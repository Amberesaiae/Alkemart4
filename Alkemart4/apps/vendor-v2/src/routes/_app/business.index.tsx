import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Download04Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/console-ui/components/card"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { BusinessOverviewView } from "@workspace/console-ui/components/console/business-overview"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { RangePicker } from "@workspace/console-ui/components/console/range-picker"
import { ErrorState } from "@workspace/console-ui/components/console/states"
import { DEFAULT_RANGE, monthLabel, rangeKey, type RangePreset, type RangeValue } from "@workspace/console-ui/lib/business"
import { downloadOrders, getOverview, listStatements } from "@/lib/business"

type Search = { preset?: RangePreset; year?: number; from?: string; to?: string }
const PRESETS: RangePreset[] = ["7d", "30d", "90d", "12m", "ytd", "since_joined", "all"]
const DAY = /^\d{4}-\d{2}-\d{2}$/

export const Route = createFileRoute("/_app/business/")({
  validateSearch: (s: Record<string, unknown>): Search => {
    if (typeof s.from === "string" && typeof s.to === "string" && DAY.test(s.from) && DAY.test(s.to)) return { from: s.from, to: s.to }
    if (typeof s.year === "number" || (typeof s.year === "string" && /^\d{4}$/.test(s.year))) return { year: Number(s.year) }
    if (PRESETS.includes(s.preset as RangePreset)) return { preset: s.preset as RangePreset }
    return {}
  },
  component: BusinessPage,
})

const toRange = (s: Search): RangeValue => (s.from && s.to ? { from: s.from, to: s.to } : s.year ? { year: s.year } : s.preset ? { preset: s.preset } : DEFAULT_RANGE)

/**
 * The seller's business at a glance for any period — last week to since they
 * joined — compared with the period before, plus the files to keep: every
 * order in the range as CSV, and frozen monthly statements.
 */
function BusinessPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const range = toRange(search)
  const q = useQuery({ queryKey: ["business", rangeKey(range)], queryFn: () => getOverview(range), placeholderData: (p) => p })
  const [exporting, setExporting] = useState(false)
  const joinedYear = q.data?.joinedAt ? new Date(q.data.joinedAt).getFullYear() : new Date().getFullYear()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business"
        description="How your shop is doing, for any period — and records you can keep."
        actions={
          <Button
            variant="outline"
            size="lg"
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              try {
                await downloadOrders(range)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Couldn't download.")
              } finally {
                setExporting(false)
              }
            }}
          >
            {exporting ? <Spinner /> : <HugeiconsIcon icon={Download04Icon} data-icon="inline-start" />} Orders (CSV)
          </Button>
        }
      />
      <RangePicker
        value={range}
        onChange={(v) => void navigate({ to: "/business", search: v, replace: true })}
        firstYear={joinedYear}
        longest={{ preset: "since_joined", label: "Since you joined" }}
      />
      {q.isError ? (
        <ErrorState title="Your numbers didn't load" error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          {q.data ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {q.data.range.label}
              {q.data.comparable ? ` · compared with the ${Math.round((+new Date(q.data.range.to) - +new Date(q.data.range.from)) / 86_400_000)} days before` : ""}
            </p>
          ) : null}
          <BusinessOverviewView data={q.data} audience="seller" loading={q.isPending} />
        </>
      )}
      <StatementsCard />
    </div>
  )
}

function StatementsCard() {
  const q = useQuery({ queryKey: ["statements"], queryFn: listStatements })
  const [showAll, setShowAll] = useState(false)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly statements</CardTitle>
        <CardDescription>
          Each month is frozen when it ends, with a fingerprint that proves it wasn't changed. Keep them for your records, a loan application or tax.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : q.isError ? (
          <ErrorState title="Statements didn't load" error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <ul className="divide-y">
            {(showAll ? q.data : q.data.slice(0, 6)).map((m) => (
              <li key={m.period}>
                <Link
                  to="/business/statements/$period"
                  params={{ period: m.period }}
                  className="flex min-h-12 items-center justify-between gap-3 py-2 hover:underline"
                >
                  <span className="font-semibold">{monthLabel(m.period)}</span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {m.status === "open" ? "So far" : "Closed"}
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {q.data && q.data.length > 6 ? (
          <Button variant="ghost" size="lg" className="mt-2" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${q.data.length} months`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
