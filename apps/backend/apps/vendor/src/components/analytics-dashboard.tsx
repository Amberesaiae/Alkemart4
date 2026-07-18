/**
 * Seller Hub analytics — same chart kit as Admin, seller-scoped data only.
 */
import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { CHART, formatGhs, formatNum, shortDate } from "../lib/chart-theme"
import {
  loadSellerStats,
  type SellerStatsPayload,
} from "../lib/seller-stats"

export function SellerAnalyticsDashboard() {
  const [data, setData] = useState<SellerStatsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const json = await loadSellerStats()
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not load seller analytics",
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const currency = data?.series.primary_currency?.toUpperCase() || "GHS"
  const gmvPrimary =
    data?.orders.gmv_by_currency?.[data.series.primary_currency] ??
    Object.values(data?.orders.gmv_by_currency || {})[0] ??
    0

  const daySeries =
    data?.series.days.map((d) => ({
      ...d,
      label: shortDate(d.date),
    })) ?? []

  const statusData = data?.orders.by_status ?? []
  const mixData = data?.catalog_mix ?? []

  return (
    <div className="alk-page">
      <header className="alk-page-header">
        <div>
          <div className="alk-badge" style={{ marginBottom: 8 }}>
            alkemart · Seller Hub
          </div>
          <h1>Your shop analytics</h1>
          <p>
            Orders and sales for your shop only — not the whole marketplace.
          </p>
        </div>
        {data?.generated_at ? (
          <p style={{ fontSize: 12, color: "#5c5c5c" }}>
            Updated {new Date(data.generated_at).toLocaleString()}
          </p>
        ) : null}
      </header>

      {loading ? <div className="alk-empty">Loading your stats…</div> : null}
      {error ? (
        <div className="alk-error">
          {error}
          <div style={{ marginTop: 8, fontSize: 12 }}>
            Select your store first if prompted. Empty charts mean this shop has
            no sales yet — list an offer, then place a COD order on the storefront.
          </div>
        </div>
      ) : null}

      {data?.readiness && data.readiness.phase !== "active" ? (
        <div className="alk-banner" style={{ marginBottom: 16 }}>
          <strong>
            Setup: {data.readiness.phase.replace(/_/g, " ")}
          </strong>
          <span className="alk-banner-body">
            {data.readiness.next_action?.label ||
              "Finish shop setup before listing offers."}
            {!data.readiness.can_propose_products
              ? " You cannot submit products for review yet."
              : ""}
          </span>
        </div>
      ) : null}

      {data && !loading ? (
        <>
          <div className="alk-kpi-grid">
            <div className="alk-kpi">
              <div className="alk-kpi-label">Orders</div>
              <div className="alk-kpi-value">{formatNum(data.orders.total)}</div>
              <div className="alk-kpi-hint">Your shop orders</div>
            </div>
            <div className="alk-kpi">
              <div className="alk-kpi-label">Sales / GMV ({currency})</div>
              <div className="alk-kpi-value">
                {currency === "GHS" ? formatGhs(gmvPrimary) : formatNum(gmvPrimary)}
              </div>
              <div className="alk-kpi-hint">
                Gross merchandise value — sum of your order totals
              </div>
            </div>
            <div className="alk-kpi">
              <div className="alk-kpi-label">Offers</div>
              <div className="alk-kpi-value">{formatNum(data.offers.total)}</div>
              <div className="alk-kpi-hint">Your sellables</div>
            </div>
            <div className="alk-kpi">
              <div className="alk-kpi-label">Products</div>
              <div className="alk-kpi-value">
                {formatNum(data.products.published)}
              </div>
              <div className="alk-kpi-hint">Published in your catalog</div>
            </div>
          </div>

          <div className="alk-chart-grid">
            <section className="alk-chart-card" style={{ gridColumn: "1 / -1" }}>
              <h2>Orders & sales (30 days)</h2>
              <p className="alk-chart-sub">
                Your shop only · bars = orders · yellow = sales total (GMV)
              </p>
              <div className="alk-chart-body" style={{ minHeight: 260 }}>
                {daySeries.every((d) => d.orders === 0 && d.gmv === 0) ? (
                  <div className="alk-empty">
                    No orders for your shop in the last 30 days yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart
                      data={daySeries}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="sellerGmv" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor={CHART.yellow}
                            stopOpacity={0.45}
                          />
                          <stop
                            offset="100%"
                            stopColor={CHART.yellow}
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke={CHART.grid}
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: CHART.gray }}
                        tickLine={false}
                        axisLine={{ stroke: CHART.border }}
                      />
                      <YAxis
                        yAxisId="orders"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: CHART.gray }}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                      />
                      <YAxis
                        yAxisId="gmv"
                        orientation="right"
                        tick={{ fontSize: 11, fill: CHART.gray }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip contentStyle={CHART.tooltip} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        yAxisId="orders"
                        dataKey="orders"
                        name="Orders"
                        fill={CHART.black}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                      <Area
                        yAxisId="gmv"
                        type="monotone"
                        dataKey="gmv"
                        name={`Sales GMV (${currency})`}
                        stroke={CHART.yellow}
                        strokeWidth={2}
                        fill="url(#sellerGmv)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="alk-chart-card">
              <h2>Orders by status</h2>
              <p className="alk-chart-sub">Your fulfillment pipeline</p>
              <div className="alk-chart-body">
                {statusData.length === 0 ? (
                  <div className="alk-empty">No order statuses yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={statusData} layout="vertical">
                      <CartesianGrid
                        stroke={CHART.grid}
                        horizontal={false}
                        strokeDasharray="3 3"
                      />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={88}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip contentStyle={CHART.tooltip} />
                      <Bar dataKey="value" name="Orders" radius={[0, 4, 4, 0]}>
                        {statusData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART.series[i % CHART.series.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="alk-chart-card">
              <h2>Shop mix</h2>
              <p className="alk-chart-sub">Offers · products · orders</p>
              <div className="alk-chart-body">
                {mixData.length === 0 ? (
                  <div className="alk-empty">
                    Create an offer in Seller Hub to populate this chart.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={mixData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {mixData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART.series[i % CHART.series.length]}
                            stroke="#fff"
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={CHART.tooltip} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}
