import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

export const config = defineWidgetConfig({
  zone: "orders.list.before",
})

/** Brand banner above orders list — links to alkemart Analytics. */
export default function OrdersListBanner() {
  return (
    <div className="alk-banner">
      <strong>alkemart Admin</strong>
      <span style={{ fontSize: 13, color: "#5c5c5c" }}>
        Marketplace orders · GMV and trends live on Analytics
      </span>
      <a href="/analytics">Open analytics →</a>
    </div>
  )
}
