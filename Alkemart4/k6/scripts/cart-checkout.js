import http from "k6/http"
import { check, sleep } from "k6"
import { Rate, Trend } from "k6/metrics"

const BASE_URL = __ENV.API_URL || "http://localhost:9000"
const PK = __ENV.E2E_PUBLISHABLE_KEY || ""

const cartDuration = new Trend("cart_duration")
const checkoutDuration = new Trend("checkout_duration")
const errorRate = new Rate("errors")

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 20 },
    { duration: "30s", target: 5 },
  ],
  thresholds: {
    cart_duration: ["p95<1000"],
    checkout_duration: ["p95<3000"],
    errors: ["rate<0.10"],
  },
}

export default function () {
  const headers = { "x-publishable-api-key": PK, "Content-Type": "application/json", Accept: "application/json" }

  const catalogRes = http.get(`${BASE_URL}/store/alkemart/catalog?limit=5`, {
    headers: { "x-publishable-api-key": PK, Accept: "application/json" },
  })
  if (catalogRes.status !== 200) {
    errorRate.add(1)
    sleep(1)
    return
  }

  let products
  try { products = JSON.parse(catalogRes.body)?.products || [] } catch { products = [] }
  if (products.length === 0) {
    sleep(1)
    return
  }

  const product = products[0]
  const variantId = product.variants?.[0]?.id
  if (!variantId) { sleep(1); return }

  const cartRes = http.post(`${BASE_URL}/store/carts`, JSON.stringify({
    currency_code: "ghs",
    region_id: product.region_id,
  }), { headers })
  check(cartRes, { "cart created": (r) => r.status === 200 })
  cartDuration.add(cartRes.timings.duration)
  errorRate.add(cartRes.status >= 400)

  let cartId
  try { cartId = JSON.parse(cartRes.body)?.cart?.id } catch {}
  if (!cartId) { sleep(1); return }

  http.post(`${BASE_URL}/store/carts/${cartId}/line-items`, JSON.stringify({
    variant_id: variantId, quantity: 1,
  }), { headers })

  http.post(`${BASE_URL}/store/carts/${cartId}/shipping-address`, JSON.stringify({
    address: { first_name: "Load", last_name: "Test", address_1: "1 Test St", city: "Accra", country_code: "gh", postal_code: "12345", phone: "+233500000000" },
  }), { headers })

  const completeRes = http.post(`${BASE_URL}/store/carts/${cartId}/complete`, "{}", { headers })
  checkoutDuration.add(completeRes.timings.duration)
  errorRate.add(completeRes.status >= 400)

  sleep(Math.random() * 2 + 1)
}
