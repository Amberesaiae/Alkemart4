import http from "k6/http"
import { check, sleep } from "k6"
import { Rate, Trend } from "k6/metrics"

const BASE_URL = __ENV.API_URL || "http://localhost:9000"
const PK = __ENV.E2E_PUBLISHABLE_KEY || ""

const catalogDuration = new Trend("catalog_duration")
const pdpDuration = new Trend("pdp_duration")
const errorRate = new Rate("errors")

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    catalog_duration: ["p95<500"],
    pdp_duration: ["p95<1000"],
    errors: ["rate<0.05"],
  },
}

export default function () {
  const headers = { "x-publishable-api-key": PK, Accept: "application/json" }

  const catalogRes = http.get(`${BASE_URL}/store/alkemart/catalog?limit=20`, { headers })
  check(catalogRes, { "catalog status 200": (r) => r.status === 200 })
  catalogDuration.add(catalogRes.timings.duration)
  errorRate.add(catalogRes.status >= 400)

  if (catalogRes.status === 200) {
    try {
      const body = JSON.parse(catalogRes.body)
      const products = body?.products || body?.data || []
      if (products.length > 0) {
        const p = products[0]
        if (p.id || p.product_id) {
          const id = p.id || p.product_id
          const pdpRes = http.get(`${BASE_URL}/store/products/${id}`, { headers })
          check(pdpRes, { "pdp status 200": (r) => r.status === 200 })
          pdpDuration.add(pdpRes.timings.duration)
          errorRate.add(pdpRes.status >= 400)
        }
      }
    } catch {}
  }

  sleep(Math.random() * 2 + 0.5)
}
