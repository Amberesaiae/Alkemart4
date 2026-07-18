import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
jest.setTimeout(60 * 1000)

/**
 * Onboarding / moderation routes — auth required for vendor/admin.
 * Assert shape of public-ish failures and unauthenticated 401s.
 */
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api }) => {
    describe("Onboarding & moderation auth boundaries", () => {
      it("GET /vendor/alkemart/onboarding/status without auth is unauthorized", async () => {
        const response = await api.get("/vendor/alkemart/onboarding/status")
        expect([401, 403]).toContain(response.status)
      })

      it("GET /admin/alkemart/moderation/sellers without auth is unauthorized", async () => {
        const response = await api.get("/admin/alkemart/moderation/sellers")
        expect([401, 403]).toContain(response.status)
      })

      it("GET /admin/alkemart/moderation/products without auth is unauthorized", async () => {
        const response = await api.get("/admin/alkemart/moderation/products")
        expect([401, 403]).toContain(response.status)
      })
    })
  },
})
