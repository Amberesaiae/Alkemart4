import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

export const config = defineWidgetConfig({
  zone: "orders.list.before",
})

export default function OrdersListBanner() {
  return (
    <div className="alk-banner">
      <strong>alkemart Seller Hub</strong>
      <span style={{ fontSize: 13, color: "#5c5c5c" }}>
        Your shop orders · trends on Analytics
      </span>
      <a href="/analytics">Open analytics →</a>
    </div>
  )
}
