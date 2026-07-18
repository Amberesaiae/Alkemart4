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
      body="Before submitting for review: clear title (8+ characters), description, and at least one JPEG/PNG/WebP image. Proposed products need a quality score of 40+. Finish shop setup (location + Ghana delivery) first — check the readiness banner above."
    />
  )
}
