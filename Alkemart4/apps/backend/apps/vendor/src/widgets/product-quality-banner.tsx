import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"
import { AlkBanner } from "../components/ui"

export const config = defineWidgetConfig({
  zone: "product.list.before",
})

/**
 * Seller Hub products list — quality + propose guidance (static tips).
 * Per-product scores: GET /vendor/alkemart/products/:id/quality
 */
export default function ProductQualityBanner() {
  return (
    <AlkBanner
      title="Listing quality tips"
      body="Tips: clear title, short description, one photo. Scores are guidance only."
      onClick={() => { window.location.href = "/vendor/products/create" }}
    />
  )
}
