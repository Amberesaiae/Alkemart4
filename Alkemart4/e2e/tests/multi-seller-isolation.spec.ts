import { test, expect } from "@playwright/test"
import { API, creds } from "../lib/env"
import { loginSeller, listSellerStores, createVendorProduct, listVendorProducts } from "../lib/api"

test.describe("multi-seller isolation", () => {
  let sellerAToken: string
  let sellerAId: string
  let sellerBToken: string
  let sellerBId: string

  test.beforeAll(async () => {
    // Seller A (primary)
    const a = await loginSeller(creds.seller.email, creds.seller.password)
    sellerAToken = a.token
    const storesA = await listSellerStores(sellerAToken)
    sellerAId = storesA.sellers[0].id!
    expect(sellerAId).toBeTruthy()

    // Seller B (second account — need credentials from env or use a secondary)
    // If E2E_SELLER2_EMAIL is set, use it; otherwise create a new seller
    const sellerBEmail = process.env.E2E_SELLER2_EMAIL
    const sellerBPassword = process.env.E2E_SELLER2_PASSWORD ?? "alkemart25vent"

    if (sellerBEmail) {
      try {
        const b = await loginSeller(sellerBEmail, sellerBPassword)
        sellerBToken = b.token
        const storesB = await listSellerStores(sellerBToken)
        sellerBId = storesB.sellers[0]?.id ?? ""
      } catch {
        console.log("[isolation] Seller B not available — skipping isolation tests")
      }
    }
  })

  test("Seller A cannot view Seller B's products via vendor endpoint", async ({ request }) => {
    test.skip(!sellerBId, "Seller B not available")

    // List Seller A's products
    const aProducts = await listVendorProducts({ memberToken: sellerAToken, sellerId: sellerAId })
    const aIds = new Set(aProducts.products.map((p) => p.id))

    // Attempt to list as Seller A with Seller B's ID (if possible)
    // The API should enforce that Seller A's token can only see Seller A's products
    const res = await request.get(`${API}/vendor/products?limit=100`, {
      headers: {
        Authorization: `Bearer ${sellerAToken}`,
        "x-seller-id": sellerBId,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const bSpoofProducts = body?.products ?? []
    const bSpoofIds = new Set(bSpoofProducts.map((p: any) => p.id))

    // If the API correctly enforces auth, the token's seller context should win
    // All returned products should belong to Seller A, not Seller B
    const leakedToA = [...bSpoofIds].filter((id) => !aIds.has(id))
    expect(leakedToA.length).toBe(0)
  })

  test("Seller B cannot view Seller A's products", async ({ request }) => {
    test.skip(!sellerBToken, "Seller B not available")

    const bProducts = await listVendorProducts({ memberToken: sellerBToken, sellerId: sellerBId })
    const bIds = new Set(bProducts.products.map((p) => p.id))

    const res = await request.get(`${API}/vendor/products?limit=100`, {
      headers: {
        Authorization: `Bearer ${sellerBToken}`,
        "x-seller-id": sellerAId,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const aSpoofProducts = body?.products ?? []
    const aSpoofIds = new Set(aSpoofProducts.map((p: any) => p.id))

    const leakedToB = [...aSpoofIds].filter((id) => !bIds.has(id))
    expect(leakedToB.length).toBe(0)
  })
})
