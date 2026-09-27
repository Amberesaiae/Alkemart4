import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Alert02Icon, Search01Icon, Store01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/console-ui/components/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/console-ui/components/chart"
import { Input } from "@workspace/console-ui/components/input"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@workspace/console-ui/components/toggle-group"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { StatCard } from "@workspace/console-ui/components/console/stat-card"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { timeAgo } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { useTraffic } from "@/lib/queries"
import { addAlias, getSearchInsights, listAliases, reviewAlias } from "@/lib/search"

export const Route = createFileRoute("/_app/analytics")({ component: AnalyticsPage })

const chartConfig = {
  found: { label: "Found something", color: "var(--chart-1)" },
  zero: { label: "Found nothing", color: "var(--destructive)" },
} satisfies ChartConfig
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })

function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const q = useQuery({ queryKey: ["search-insights", days], queryFn: () => getSearchInsights(days), staleTime: 120_000 })
  const d = q.data
  const rate = d && d.searches ? Math.round((d.zeroResultSearches / d.searches) * 100) : 0
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="What buyers look for, and where the marketplace lets them down. Sales and traffic are on Overview."
        actions={
          <ToggleGroup type="single" variant="outline" value={String(days)} onValueChange={(v) => v && setDays(Number(v))} aria-label="Period">
            {[7, 30, 90].map((n) => (
              <ToggleGroupItem key={n} value={String(n)} className="min-h-10 px-3.5">
                {n} days
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />
      {q.isError ? <ErrorState title="Search numbers didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" /> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Searches" value={d ? d.searches.toLocaleString() : "—"} icon={Search01Icon} loading={q.isPending} hint={`Last ${days} days`} />
        <StatCard label="Found nothing" value={d ? `${rate}%` : "—"} icon={Alert02Icon} loading={q.isPending} hint={d ? `${d.zeroResultSearches.toLocaleString()} searches` : undefined} />
        <StatCard label="Top search" value={d?.top[0] ? `“${d.top[0].query}”` : "—"} icon={Search01Icon} loading={q.isPending} className="col-span-2 lg:col-span-1" hint={d?.top[0] ? `${d.top[0].count} times` : undefined} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Searches per day</CardTitle>
          <CardDescription>Red is searches that showed no products — each one is a buyer we couldn't help.</CardDescription>
        </CardHeader>
        <CardContent>
          {q.isPending ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : !d?.byDay.length ? (
            <EmptyState icon={Search01Icon} title="No searches yet in this period" />
          ) : (
            <ChartContainer config={chartConfig} className="h-56 w-full" aria-label={`Searches per day over the last ${days} days`}>
              <BarChart data={d.byDay.map((x) => ({ date: x.date, found: x.searches - x.zero, zero: x.zero }))} margin={{ left: 0, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={fmtDay} />
                <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtDay(String(v))} />} />
                <Bar dataKey="found" stackId="s" fill="var(--color-found)" maxBarSize={48} />
                <Bar dataKey="zero" stackId="s" fill="var(--color-zero)" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <ZeroResults items={d?.zero ?? []} loading={q.isPending} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top searches</CardTitle>
            <CardDescription>What buyers want most — stock up and merchandise these.</CardDescription>
          </CardHeader>
          <CardContent>
            {q.isPending ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : !d?.top.length ? (
              <p className="text-sm text-muted-foreground">No searches yet.</p>
            ) : (
              <ol className="divide-y">
                {d.top.map((t, i) => (
                  <li key={t.query} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-6 text-right tabular text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{t.query}</span>
                    <span className={cn("tabular", t.avgResults === 0 && "text-destructive")}>{t.avgResults} results</span>
                    <span className="w-14 text-right font-semibold tabular">{t.count}×</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Vocabulary />
      <TopShops />
    </div>
  )
}

function ZeroResults({ items, loading }: { items: { query: string; count: number; lastAt: string }[]; loading: boolean }) {
  const qc = useQueryClient()
  const [fixing, setFixing] = useState<string | null>(null)
  const [target, setTarget] = useState("")
  const [type, setType] = useState<"synonym" | "redirect">("synonym")
  const fix = useMutation({
    mutationFn: () => addAlias(fixing!, target.trim(), type),
    onSuccess: () => {
      toast.success(type === "synonym" ? `“${fixing}” now also searches “${target.trim()}”.` : `“${fixing}” now goes to ${target.trim()}.`)
      setFixing(null)
      setTarget("")
      void qc.invalidateQueries({ queryKey: ["aliases"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save."),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Searches that found nothing</CardTitle>
        <CardDescription>Fix a spelling or local word by pointing it at what we do sell — or find sellers for it.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : !items.length ? (
          <p className="text-sm text-muted-foreground">Every search found something. 🎉</p>
        ) : (
          <ul className="divide-y">
            {items.map((z) => (
              <li key={z.query} className="space-y-2 py-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">“{z.query}”</span>
                  <span className="text-muted-foreground">{timeAgo(z.lastAt)}</span>
                  <span className="w-10 text-right font-semibold tabular">{z.count}×</span>
                  {fixing !== z.query ? (
                    <Button size="sm" variant="outline" onClick={() => (setFixing(z.query), setTarget(""))}>
                      Fix
                    </Button>
                  ) : null}
                </div>
                {fixing === z.query ? (
                  <div className="space-y-2 rounded-xl bg-muted p-3">
                    <ToggleGroup type="single" variant="outline" value={type} onValueChange={(v) => v && setType(v as "synonym" | "redirect")} className="justify-start">
                      <ToggleGroupItem value="synonym" className="px-3">
                        Means the same as…
                      </ToggleGroupItem>
                      <ToggleGroupItem value="redirect" className="px-3">
                        Send to a page
                      </ToggleGroupItem>
                    </ToggleGroup>
                    <Input
                      aria-label={type === "synonym" ? "Words it means" : "Page to send to"}
                      placeholder={type === "synonym" ? "e.g. shea butter" : "e.g. /categories/beauty"}
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={!target.trim() || fix.isPending || (type === "redirect" && !target.trim().startsWith("/"))} onClick={() => fix.mutate()}>
                        Save fix
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setFixing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Vocabulary() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["aliases"], queryFn: listAliases, staleTime: 60_000 })
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => reviewAlias(id, decision),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["aliases"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save."),
  })
  const proposed = (q.data ?? []).filter((a) => a.status === "proposed")
  const live = (q.data ?? []).filter((a) => a.status === "approved")
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Search words</CardTitle>
        <CardDescription>Local names and spellings that map to what we sell. Words sellers suggest wait for approval here.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {proposed.length ? (
          <ul className="space-y-2">
            {proposed.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-info-soft p-3 text-sm">
                <span className="min-w-0 flex-1">
                  “{a.term}” {a.type === "synonym" ? "means" : "goes to"} <strong>{a.target}</strong>
                </span>
                <Button size="sm" onClick={() => review.mutate({ id: a.id, decision: "approved" })}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => review.mutate({ id: a.id, decision: "rejected" })}>
                  Reject
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {q.isPending ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : live.length ? (
          <ul className="flex flex-wrap gap-2">
            {live.map((a) => (
              <li key={a.id} className="rounded-full border px-3 py-1 text-sm">
                {a.term} → {a.target}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No search words yet — fix a failed search above to add one.</p>
        )}
      </CardContent>
    </Card>
  )
}

function TopShops() {
  const q = useTraffic()
  const shops = q.data?.top_shops ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Most-visited shops</CardTitle>
        <CardDescription>Shop page views, last 30 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : !shops.length ? (
          <EmptyState icon={Store01Icon} title="No shop visits yet" />
        ) : (
          <ol className="divide-y">
            {shops.map((s, i) => (
              <li key={s.sellerId} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-6 text-right tabular text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                <span className="font-semibold tabular">{s.views.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
