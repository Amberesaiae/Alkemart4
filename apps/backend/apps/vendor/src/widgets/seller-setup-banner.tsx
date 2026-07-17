import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

export const config = defineWidgetConfig({
  zone: "seller.setup.before",
})

export default function SellerSetupBanner() {
  return (
    <div className="alk-banner">
      <strong>Welcome to alkemart</strong>
      <span style={{ fontSize: 13, color: "#5c5c5c" }}>
        Finish setup, then list offers buyers can purchase with cash on delivery.
      </span>
    </div>
  )
}
