import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { ChartColumn } from "lucide-react"
import { AnalyticsDashboard } from "../../components/analytics-dashboard"

declare const __BACKEND_URL__: string

export const config: RouteConfig = {
  label: "Analytics",
  icon: ChartColumn,
  rank: 0,
}

/**
 * Platform analytics for alkemart Admin.
 * Data from GET /admin/alkemart/stats (Medusa graph — SoR).
 */
export default function AdminAnalyticsPage() {
  const base = (typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__
    ? __BACKEND_URL__
    : "http://localhost:9000"
  ).replace(/\/$/, "")

  return (
    <AnalyticsDashboard
      mode="admin"
      title="Platform analytics"
      subtitle="Live orders, GMV, sellers, and catalog from GET /admin/alkemart/stats (Medusa graph on Postgres)."
      statsUrl={`${base}/admin/alkemart/stats`}
    />
  )
}
