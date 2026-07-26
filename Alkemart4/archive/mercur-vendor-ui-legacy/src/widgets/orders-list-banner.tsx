import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"
import { panelHref } from "../lib/panel-href"
import { AlkBanner } from "../components/ui"

export const config = defineWidgetConfig({
  zone: "orders.list.before",
})

export default function OrdersListBanner() {
  return (
    <AlkBanner
      title="alkemart Seller Hub"
      body="Your shop orders · trends on Analytics"
      action={<a href={panelHref("analytics")}>Open analytics →</a>}
    />
  )
}
