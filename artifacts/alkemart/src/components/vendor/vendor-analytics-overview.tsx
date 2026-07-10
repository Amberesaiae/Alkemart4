import { useNavigate } from "@tanstack/react-router";
import { useGetVendorAnalytics } from "@workspace/api-client-react";
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

const unitsChartConfig: ChartConfig = {
  unitsSold: { label: "Units sold", color: "hsl(142 71% 45%)" },
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-display text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export function VendorAnalyticsOverview() {
  const navigate = useNavigate();
  const { data, isLoading } = useGetVendorAnalytics();

  if (isLoading || !data) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading analytics…</div>;
  }

  const totalRevenue = data.revenueSeries.reduce((sum, p) => sum + p.revenuePesewas, 0);
  const totalOrders = data.orderStatusBreakdown.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Revenue (confirmed + fulfilled)" value={pesewasToGhs(totalRevenue)} />
        <StatCard label="Total orders" value={String(totalOrders)} />
        <StatCard label="Low-stock products" value={String(data.lowStockProducts.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-lg">Sales over time</CardTitle>
            <CardDescription>Daily revenue from confirmed and fulfilled orders</CardDescription>
          </CardHeader>
          <CardContent>
            {data.revenueSeries.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No sales yet.</div>
            ) : (
              <>
              <ChartContainer config={revenueChartConfig} className="aspect-auto h-[280px] w-full">
                <LineChart
                  data={data.revenueSeries}
                  margin={{ left: 4, right: 12 }}
                  onClick={(state) => {
                    const rawDate = state?.activePayload?.[0]?.payload?.date as string | undefined;
                    if (rawDate) {
                      navigate({ to: "/vendor/orders", search: { date: rawDate.slice(0, 10) } });
                    }
                  }}
                  className="cursor-pointer"
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => `${v}`} formatter={(value) => pesewasToGhs(Number(value))} />} />
                  <Line
                    type="monotone"
                    dataKey="revenuePesewas"
                    stroke="var(--color-revenuePesewas)"
                    strokeWidth={2}
                    dot={{ r: 3, cursor: "pointer" }}
                    activeDot={{ r: 5, cursor: "pointer" }}
                  />
                </LineChart>
              </ChartContainer>
              <p className="mt-2 text-xs text-muted-foreground">Click a point to see that day's orders.</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Orders by status</CardTitle>
            <CardDescription>Orders containing your products</CardDescription>
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
            <CardTitle className="font-display text-lg">Top products</CardTitle>
            <CardDescription>By units sold, confirmed + fulfilled orders</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No product sales yet.</div>
            ) : (
              <>
              <ChartContainer config={unitsChartConfig} className="aspect-auto h-[260px] w-full">
                <BarChart
                  data={data.topProducts}
                  layout="vertical"
                  margin={{ left: 12, right: 12 }}
                  onClick={(state) => {
                    const productId = state?.activePayload?.[0]?.payload?.productId as number | undefined;
                    if (productId != null) {
                      navigate({ to: "/vendor/products", search: { highlight: productId } });
                    }
                  }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="unitsSold" fill="var(--color-unitsSold)" radius={4} className="cursor-pointer" />
                </BarChart>
              </ChartContainer>
              <p className="mt-2 text-xs text-muted-foreground">Click a bar to jump to that product.</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Low stock</CardTitle>
            <CardDescription>Active products at 10 units or fewer</CardDescription>
          </CardHeader>
          <CardContent>
            {data.lowStockProducts.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Nothing running low right now.</div>
            ) : (
              <div className="space-y-2">
                {data.lowStockProducts.map((p) => (
                  <div key={p.productId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span className="font-medium">{p.title}</span>
                    <Badge variant={p.stock === 0 ? "destructive" : "outline"}>{p.stock} left</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
