import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"
import { AlkBanner } from "../components/ui"

export const config = defineWidgetConfig({
  zone: "seller.setup.before",
})

export default function SellerSetupBanner() {
  return (
    <AlkBanner
      title="Almost ready to sell"
      body="Finish setup, then list offers buyers can purchase with cash on delivery or MoMo."
    />
  )
}
