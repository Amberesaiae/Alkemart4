import { createFileRoute } from "@tanstack/react-router"
import { useMarkets } from "../../hooks/use-markets"
import type { Market } from "../../lib/api"
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, EmptyState } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Globe2 } from "lucide-react"

export const Route = createFileRoute("/_authenticated/markets")({
  component: MarketsPage,
})

function MarketsPage() {
  const { data, isLoading, isError } = useMarkets()

  if (isLoading) {
    return (
      <PageShell>
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </PageShell>
    )
  }

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          Failed to load markets.
        </div>
      </PageShell>
    )
  }

  const markets = data?.markets || []

  return (
    <PageShell>
      <PageHeader title="Operating Markets" description="Countries currently in operation. Used for localized routing, currency, and address rules." />

      {markets.length === 0 ? (
        <EmptyState icon={<Globe2 className="h-12 w-12 text-muted-foreground/50" />}
          title="No active markets"
          description="Configure regions via backend to see markets here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map((market: Market) => (
            <Card key={market.region_id} className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="flex justify-between items-center text-lg">
                  {market.display_name || market.name}
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {market.currency_code?.toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground block mb-2">Supported Countries</span>
                    <div className="flex flex-wrap gap-2">
                      {market.countries ? market.countries.map((c) => (
                        <Badge key={c.iso_2} variant="outline" className="bg-primary/10 border-primary/20">
                          {c.name} ({c.iso_2?.toUpperCase()})
                        </Badge>
                      )) : (
                        <Badge variant="outline" className="bg-primary/10 border-primary/20">
                          {market.country_code?.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {market.locale?.payments?.preferred && (
                    <div className="pt-4 border-t">
                      <span className="font-medium text-muted-foreground block mb-2">Payment Methods</span>
                      <p className="text-foreground">
                        {market.locale.payments.preferred.map((p: string) => p.replace(/_/g, " ")).join(", ")}
                      </p>
                    </div>
                  )}
                  {market.locale?.address?.fields && (
                    <div className="pt-2">
                      <span className="font-medium text-muted-foreground block mb-1">Address Format</span>
                      <p className="text-foreground text-xs text-muted-foreground">
                        {market.locale.address.fields.map((f) => f.label).join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  )
}
