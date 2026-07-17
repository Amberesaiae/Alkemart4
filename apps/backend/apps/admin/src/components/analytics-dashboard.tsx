/**
 * Platform analytics — Recharts best practices:
 * - tabular nums, limited series, no 3D junk
 * - empty/loading states, accessible labels
 * - primary currency from API (not hard-coded GHS in chart title only as fallback)
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

export type StatsPayload = {
  generated_at: string
  products: { published: number; draft: number; total: number }
  sellers: { open: number; total: number }
  offers: { total: number }
  orders: {
    total: number
    gmv_by_currency: Record<string, number>
    by_status?: { name: string; value: number }[]
  }
  series?: {
    days: { date: string; orders: number; gmv: number }[]
    primary_currency: string
  }
  catalog_mix?: { name: string; value: number }[]
  search?: { enabled: boolean; indexed_hint?: number }
  search_index?: {
    with_seller: number
    with_price: number
    with_offer: number
  }
}

type Props = {
  title: string
  subtitle: string
  /** Absolute or relative path, e.g. /admin/alkemart/stats */
  statsUrl: string
  mode: "admin" | "seller"
}

export function AnalyticsDashboard({ title, subtitle, statsUrl, mode }: Props) {
  const [data, setData] = useState<StatsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(statsUrl, {
          credentials: "include",
          headers: { Accept: "application/json" },
        })
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? "Sign in required to load analytics."
              : `Stats request failed (${res.status})`,
          )
        }
        const json = (await res.json()) as StatsPayload
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load stats")
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [statsUrl])

  const currency = data?.series?.primary_currency?.toUpperCase() || "GHS"
  const gmvPrimary =
    data?.orders.gmv_by_currency?.[data.series?.primary_currency || "ghs"] ??
    Object.values(data?.orders.gmv_by_currency || {})[0] ??
    0

  const daySeries =
    data?.series?.days.map((d) => ({
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
            alkemart · {mode === "admin" ? "Admin" : "Seller Hub"}
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {data?.generated_at ? (
          <p style={{ fontSize: 12, color: "#5c5c5c" }}>
            Updated {new Date(data.generated_at).toLocaleString()}
          </p>
        ) : null}
      </header>

      {loading ? (
        <div className="alk-empty">Loading analytics…</div>
      ) : null}

      {error ? <div className="alk-error">{error}</div> : null}

      {data && !loading ? (
        <>
          <div className="alk-kpi-grid">
            <div className="alk-kpi">
              <div className="alk-kpi-label">Orders</div>
              <div className="alk-kpi-value">{formatNum(data.orders.total)}</div>
              <div className="alk-kpi-hint">All time (graph)</div>
            </div>
            <div className="alk-kpi">
              <div className="alk-kpi-label">GMV ({currency})</div>
              <div className="alk-kpi-value">
                {currency === "GHS" ? formatGhs(gmvPrimary) : formatNum(gmvPrimary)}
              </div>
              <div className="alk-kpi-hint">Sum of order totals</div>
            </div>
            {mode === "admin" ? (
              <>
                <div className="alk-kpi">
                  <div className="alk-kpi-label">Sellers</div>
                  <div className="alk-kpi-value">
                    {formatNum(data.sellers.open)}
                    <span
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        color: "#5c5c5c",
                      }}
                    >
                      /{formatNum(data.sellers.total)}
                    </span>
                  </div>
                  <div className="alk-kpi-hint">Open / total</div>
                </div>
                <div className="alk-kpi">
                  <div className="alk-kpi-label">Products</div>
                  <div className="alk-kpi-value">
                    {formatNum(data.products.published)}
                  </div>
                  <div className="alk-kpi-hint">
                    {formatNum(data.products.draft)} draft ·{" "}
                    {formatNum(data.offers.total)} offers
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="alk-kpi">
                  <div className="alk-kpi-label">Offers</div>
                  <div className="alk-kpi-value">
                    {formatNum(data.offers.total)}
                  </div>
                  <div className="alk-kpi-hint">Live sellables</div>
                </div>
                <div className="alk-kpi">
                  <div className="alk-kpi-label">Catalog</div>
                  <div className="alk-kpi-value">
                    {formatNum(data.products.published)}
                  </div>
                  <div className="alk-kpi-hint">Published products</div>
                </div>
              </>
            )}
          </div>

          <div className="alk-chart-grid">
            <section className="alk-chart-card" style={{ gridColumn: "1 / -1" }}>
              <h2>Orders & GMV (14 days)</h2>
              <p className="alk-chart-sub">
                Daily order count (bars) and GMV line · empty days stay on axis
              </p>
              <div className="alk-chart-body" style={{ minHeight: 260 }}>
                {daySeries.every((d) => d.orders === 0 && d.gmv === 0) ? (
                  <div className="alk-empty">No orders in this window yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart
                      data={daySeries}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
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
                      <Tooltip
                        contentStyle={CHART.tooltip}
                        labelStyle={{ fontWeight: 700 }}
                      />
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
                        name={`GMV (${currency})`}
                        stroke={CHART.yellow}
                        strokeWidth={2}
                        fill="url(#gmvFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="alk-chart-card">
              <h2>Orders by status</h2>
              <p className="alk-chart-sub">Distribution · not a funnel claim</p>
              <div className="alk-chart-body">
                {statusData.length === 0 ? (
                  <div className="alk-empty">No status breakdown yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={statusData}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid
                        stroke={CHART.grid}
                        horizontal={false}
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: CHART.gray }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={88}
                        tick={{ fontSize: 11, fill: CHART.black }}
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
              <h2>Catalog mix</h2>
              <p className="alk-chart-sub">Counts from platform graph</p>
              <div className="alk-chart-body">
                {mixData.length === 0 ? (
                  <div className="alk-empty">No catalog data.</div>
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
                            strokeWidth={1}
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

          {data.search?.enabled ? (
            <p style={{ fontSize: 12, color: "#5c5c5c" }}>
              Search index:{" "}
              {data.search.indexed_hint != null
                ? `${data.search.indexed_hint} docs`
                : "enabled"}
              {data.search_index
                ? ` · ${data.search_index.with_offer} with offer · ${data.search_index.with_seller} with seller`
                : null}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
