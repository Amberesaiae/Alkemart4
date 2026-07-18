import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
jest.setTimeout(60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api }) => {
    describe("Catalog endpoints", () => {
      describe("GET /store/products", () => {
        it("returns a product list (empty or populated)", async () => {
          const response = await api.get("/store/products")
          expect(response.status).toEqual(200)
          expect(response.data).toHaveProperty("products")
          expect(Array.isArray(response.data.products)).toBe(true)
        })
      })

      describe("GET /store/custom", () => {
        it("returns the custom endpoint response", async () => {
          const response = await api.get("/store/custom")
          expect(response.status).toEqual(200)
        })
      })

      describe("GET /store/sitemap", () => {
        it("returns sitemap data", async () => {
          const response = await api.get("/store/sitemap")
          expect(response.status).toEqual(200)
        })
      })
    })
  },
})
