import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { ChartColumn } from "lucide-react"
import { AlkErrorBoundary } from "../../components/ui"
import { SellerAnalyticsDashboard } from "../../components/analytics-dashboard"

export const config: RouteConfig = {
  label: "Analytics",
  icon: ChartColumn,
  rank: 0,
}

export default function SellerAnalyticsPage() {
  return <AlkErrorBoundary><SellerAnalyticsDashboard /></AlkErrorBoundary>
}
