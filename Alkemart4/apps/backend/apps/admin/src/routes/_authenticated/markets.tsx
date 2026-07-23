import { createFileRoute } from "@tanstack/react-router"
import { useMarkets } from "../../hooks/use-markets"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { Globe2 } from "lucide-react"

export const Route = createFileRoute("/_authenticated/markets")({
  component: MarketsPage,
})

function MarketsPage() {
  const { data, isLoading } = useMarkets()

  if (isLoading) {
    return <div className="p-8">Loading markets...</div>
  }

  const markets = data?.markets || []

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Operating Markets</h1>
        <p className="text-muted-foreground mt-2">
          Countries currently in operation. Used for localized routing, currency, and address rules.
        </p>
      </div>

      {markets.length === 0 ? (
        <div className="p-12 text-center border rounded-xl bg-card shadow-sm">
          <Globe2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium">No active markets</p>
          <p className="text-muted-foreground">Configure regions via backend to see markets here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map((market: any) => (
            <Card key={market.region_id || market.id} className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="flex justify-between items-center text-lg">
                  {market.display_name || market.name}
                  <span className="text-xs font-semibold bg-muted-foreground/10 text-foreground px-2 py-1 rounded">
                    {market.currency_code?.toUpperCase()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground block mb-2">Supported Countries</span>
                    <div className="flex flex-wrap gap-2">
                      {market.countries ? market.countries.map((c: any) => (
                        <span key={c.iso_2} className="bg-primary/10 text-foreground px-2 py-1 rounded-md text-xs font-medium border border-primary/20">
                          {c.name} ({c.iso_2?.toUpperCase()})
                        </span>
                      )) : (
                        <span className="bg-primary/10 text-foreground px-2 py-1 rounded-md text-xs font-medium border border-primary/20">
                          {market.country_code?.toUpperCase()}
                        </span>
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
                        {market.locale.address.fields.map((f: any) => f.label).join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
