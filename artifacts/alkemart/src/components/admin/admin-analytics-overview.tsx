import { useGetAdminAnalytics } from "@workspace/api-client-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";

function pesewasToGhs(pesewas: number): string {
  return `GH₵${(pesewas / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(38 92% 50%)",
  confirmed: "hsl(217 91% 60%)",
  fulfilled: "hsl(142 71% 45%)",
  cancelled: "hsl(0 84% 60%)",
};

const revenueChartConfig: ChartConfig = {
  revenuePesewas: { label: "Revenue", color: "hsl(217 91% 60%)" },
};

const fulfillmentChartConfig: ChartConfig = {
  count: { label: "Fulfillments", color: "hsl(142 71% 45%)" },
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-display text-2xl">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent>}
    </Card>
  );
}

export function AdminAnalyticsOverview() {
  const { data, isLoading } = useGetAdminAnalytics();

  if (isLoading || !data) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading analytics…</div>;
  }

  const totalRevenue = data.revenueSeries.reduce((sum, p) => sum + p.revenuePesewas, 0);
  const totalOrders = data.orderStatusBreakdown.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue (confirmed + fulfilled)" value={pesewasToGhs(totalRevenue)} />
        <StatCard label="Total orders" value={String(totalOrders)} />
        <StatCard label="Open disputes" value={String(data.openDisputeCount)} hint={`${data.totalDisputeCount} total`} />
        <StatCard label="Top vendors tracked" value={String(data.topVendors.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-lg">Revenue over time</CardTitle>
            <CardDescription>Daily revenue from confirmed and fulfilled orders</CardDescription>
          </CardHeader>
          <CardContent>
            {data.revenueSeries.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No revenue yet.</div>
            ) : (
              <ChartContainer config={revenueChartConfig} className="aspect-auto h-[280px] w-full">
                <LineChart data={data.revenueSeries} margin={{ left: 4, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => `${v}`} formatter={(value) => pesewasToGhs(Number(value))} />} />
                  <Line type="monotone" dataKey="revenuePesewas" stroke="var(--color-revenuePesewas)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Orders by status</CardTitle>
            <CardDescription>All orders, any time</CardDescription>
          </CardHeader>
          <CardContent>
            {data.orderStatusBreakdown.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No orders yet.</div>
            ) : (
              <>
                <ChartContainer config={revenueChartConfig} className="aspect-square h-[220px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie data={data.orderStatusBreakdown} dataKey="count" nameKey="status" innerRadius={50}>
                      {data.orderStatusBreakdown.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "hsl(220 9% 60%)"} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="mt-3 flex flex-wrap justify-center gap-3">
                  {data.orderStatusBreakdown.map((entry) => (
                    <div key={entry.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[entry.status] ?? "hsl(220 9% 60%)" }}
                      />
                      <span className="capitalize">{entry.status}</span>
                      <span className="font-semibold text-foreground">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Top vendors by revenue</CardTitle>
            <CardDescription>Confirmed + fulfilled orders</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topVendors.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No vendor sales yet.</div>
            ) : (
              <div className="space-y-2">
                {data.topVendors.map((v, i) => (
                  <div key={v.vendorId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                      <span className="font-medium">{v.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{v.orderCount} orders</span>
                      <span className="font-semibold text-foreground">{pesewasToGhs(v.revenuePesewas)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Fulfillment health</CardTitle>
            <CardDescription>Line-item fulfillments across all vendors, by current status</CardDescription>
          </CardHeader>
          <CardContent>
            {data.fulfillmentStatusBreakdown.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No fulfillments yet.</div>
            ) : (
              <ChartContainer config={fulfillmentChartConfig} className="aspect-auto h-[220px] w-full">
                <BarChart data={data.fulfillmentStatusBreakdown} margin={{ left: 4, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} tickMargin={8} className="capitalize" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {data.openDisputeCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <Badge variant="destructive">{data.openDisputeCount} open</Badge>
          <span>disputes currently need attention — see the Disputes tab.</span>
        </div>
      )}
    </div>
  );
}
