import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { ChartColumn } from "lucide-react"
import { AnalyticsDashboard } from "../../components/analytics-dashboard"

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
  return (
    <AnalyticsDashboard
      mode="admin"
      title="Platform analytics"
      subtitle="Orders, GMV, sellers, and catalog from the live marketplace API — not a second warehouse."
      statsUrl="/admin/alkemart/stats"
    />
  )
}
