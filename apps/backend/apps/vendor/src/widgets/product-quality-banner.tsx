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
      body="Before submitting for review: clear title (8+ characters), short description, and at least one phone photo (JPEG/PNG/WebP). Score needs 40+. Finish Ghana delivery setup first (pack address + fee) — see the banner above."
    />
  )
}
