import http from "k6/http"
import { check, sleep } from "k6"
import { Rate, Trend } from "k6/metrics"

const BASE_URL = __ENV.API_URL || "http://localhost:9000"
const PK = __ENV.E2E_PUBLISHABLE_KEY || ""

const searchDuration = new Trend("search_duration")
const errorRate = new Rate("errors")

const SEARCH_TERMS = ["phone", "shoe", "bag", "food", "shirt", "dress", "book", "watch", "oil", "rice"]

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 80 },
    { duration: "30s", target: 120 },
    { duration: "1m", target: 120 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    search_duration: ["p95<500"],
    errors: ["rate<0.03"],
  },
}

export default function () {
  const q = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)]
  const headers = { "x-publishable-api-key": PK, Accept: "application/json" }

  const res = http.get(`${BASE_URL}/store/alkemart/catalog?q=${encodeURIComponent(q)}&limit=20`, { headers })
  check(res, { "search status 200": (r) => r.status === 200 })
  searchDuration.add(res.timings.duration)
  errorRate.add(res.status >= 400)

  sleep(Math.random() * 1.5 + 0.3)
}
