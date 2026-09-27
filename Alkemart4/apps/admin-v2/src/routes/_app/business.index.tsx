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
import { useSellers } from "@/lib/queries"

type Search = { preset?: RangePreset; year?: number; from?: string; to?: string; sellerId?: string }
const PRESETS: RangePreset[] = ["7d", "30d", "90d", "12m", "ytd", "since_joined", "all"]
const DAY = /^\d{4}-\d{2}-\d{2}$/

export const Route = createFileRoute("/_app/business/")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const sellerId = typeof s.sellerId === "string" && s.sellerId ? s.sellerId : undefined
    if (typeof s.from === "string" && typeof s.to === "string" && DAY.test(s.from) && DAY.test(s.to)) return { from: s.from, to: s.to, sellerId }
    if (typeof s.year === "number" || (typeof s.year === "string" && /^\d{4}$/.test(s.year))) return { year: Number(s.year), sellerId }
    if (PRESETS.includes(s.preset as RangePreset)) return { preset: s.preset as RangePreset, sellerId }
    return { sellerId }
  },
  component: BusinessPage,
})

const toRange = (s: Search): RangeValue => (s.from && s.to ? { from: s.from, to: s.to } : s.year ? { year: s.year } : s.preset ? { preset: s.preset } : DEFAULT_RANGE)

/**
 * The marketplace's business for any period — or one shop's, the same view
 * the seller sees — with the orders behind it as CSV and frozen monthly
 * statements for the platform or a shop.
 */
function BusinessPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const range = toRange(search)
  const sellerId = search.sellerId ?? null
  const sellers = useSellers()
  const q = useQuery({ queryKey: ["business", rangeKey(range), sellerId], queryFn: () => getOverview(range, sellerId), placeholderData: (p) => p })
  const months = useQuery({ queryKey: ["statements", sellerId], queryFn: () => listStatements(sellerId) })
  const firstYear = Number((months.data?.at(-1)?.period ?? String(new Date().getFullYear())).slice(0, 4))
  const [exporting, setExporting] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const go = (next: Partial<Search> & { range?: RangeValue }) => {
    const r = next.range ?? range
    void navigate({ to: "/business", search: { ...r, sellerId: "sellerId" in next ? next.sellerId : search.sellerId }, replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business"
        description="Sales, commission and shops for any period. Pick a shop to see exactly what its seller sees."
        actions={
          <Button
            variant="outline"
            size="lg"
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              try {
                await downloadOrders(range, sellerId)
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="business-shop" className="block text-sm font-medium">
            Shop
          </label>
          <select
            id="business-shop"
            value={sellerId ?? ""}
            onChange={(e) => go({ sellerId: e.target.value || undefined })}
            className="h-10 min-w-56 rounded-4xl border bg-input/30 px-3 text-sm"
          >
            <option value="">All shops (platform)</option>
            {(sellers.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <RangePicker
        value={range}
        onChange={(v) => go({ range: v })}
        firstYear={firstYear}
        longest={sellerId ? { preset: "since_joined", label: "Since they joined" } : { preset: "all", label: "All time" }}
      />
      {q.isError ? (
        <ErrorState title="The numbers didn't load" error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          {q.data ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {q.data.sellerName ? `${q.data.sellerName} · ` : "All shops · "}
              {q.data.range.label}
              {q.data.comparable ? ", compared with the period before" : ""}
            </p>
          ) : null}
          <BusinessOverviewView data={q.data} audience="admin" loading={q.isPending} />
        </>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{sellerId ? "Shop statements" : "Platform statements"}</CardTitle>
          <CardDescription>Frozen when each month ends, with a fingerprint. Corrections appear in a later month, never as edits.</CardDescription>
        </CardHeader>
        <CardContent>
          {months.isPending ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : months.isError ? (
            <ErrorState title="Statements didn't load" error={months.error} onRetry={() => void months.refetch()} />
          ) : (
            <ul className="divide-y">
              {(showAll ? months.data : months.data.slice(0, 6)).map((m) => (
                <li key={m.period}>
                  <Link
                    to="/business/statements/$period"
                    params={{ period: m.period }}
                    search={{ sellerId: sellerId ?? undefined }}
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
          {months.data && months.data.length > 6 ? (
            <Button variant="ghost" size="lg" className="mt-2" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${months.data.length} months`}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
