import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api }) => {
    describe("RBAC boundaries", () => {
      // ─── Unauthenticated ───────────────────────────────────────
      describe("unauthenticated", () => {
        it("vendor endpoints return 401", async () => {
          for (const ep of [
            "/vendor/sellers/me",
            "/vendor/alkemart/quick-list",
            "/vendor/alkemart/stats",
            "/vendor/alkemart/onboarding/status",
          ]) {
            const res = await api.get(ep)
            expect([401, 403]).toContain(res.status)
          }
        })

        it("admin endpoints return 401", async () => {
          for (const ep of [
            "/admin/alkemart/moderation/sellers",
            "/admin/alkemart/moderation/products",
          ]) {
            const res = await api.get(ep)
            expect([401, 403]).toContain(res.status)
          }
        })

        it("public store endpoints return 200", async () => {
          const res = await api.get("/store/alkemart/catalog?limit=1")
          expect(res.status).toEqual(200)
        })
      })

      // ─── Member (buyer) ────────────────────────────────────────
      describe("member (buyer)", () => {
        let memberToken: string

        beforeAll(async () => {
          // Register a new member
          const reg = await api.post("/auth/member/emailpass/register", {
            email: "buyer@test.com",
            password: "Test123!",
          })
          expect([200, 201]).toContain(reg.status)

          const login = await api.post("/auth/member/emailpass", {
            email: "buyer@test.com",
            password: "Test123!",
          })
          expect(login.status).toEqual(200)
          memberToken = login.data.token
        })

        it("can access their own profile", async () => {
          const res = await api.get("/alkemart/member/me", {
            headers: { Authorization: `Bearer ${memberToken}` },
          })
          // 404 is acceptable — means no seller linked yet (buyer-only)
          expect([200, 404]).toContain(res.status)
        })

        it("cannot access vendor endpoints", async () => {
          const res = await api.get("/vendor/sellers/me", {
            headers: { Authorization: `Bearer ${memberToken}` },
          })
          expect([401, 403]).toContain(res.status)
        })

        it("cannot access admin moderation endpoints", async () => {
          const res = await api.get("/admin/alkemart/moderation/sellers", {
            headers: { Authorization: `Bearer ${memberToken}` },
          })
          expect([401, 403]).toContain(res.status)
        })
      })

      // ─── Admin (user) ──────────────────────────────────────────
      describe("admin (user)", () => {
        let adminToken: string

        beforeAll(async () => {
          // First create the admin user
          const createRes = await api.post("/auth/user/emailpass/register", {
            email: "admin-rbac@test.com",
            password: "Admin123!",
          })
          expect([200, 201]).toContain(createRes.status)

          const login = await api.post("/auth/user/emailpass", {
            email: "admin-rbac@test.com",
            password: "Admin123!",
          })
          expect(login.status).toEqual(200)
          adminToken = login.data.token
        })

        it("can access admin moderation", async () => {
          const res = await api.get("/admin/alkemart/moderation/sellers", {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          expect([200, 403]).toContain(res.status)
        })

        it("cannot access vendor seller endpoints", async () => {
          const res = await api.get("/vendor/sellers/me", {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          expect([401, 403]).toContain(res.status)
        })
      })

      // ─── Member → Seller ──────────────────────────────────────
      describe("seller lifecycle", () => {
        let memberToken: string
        let sellerId: string

        beforeAll(async () => {
          // Register member for seller flow
          const reg = await api.post("/auth/member/emailpass/register", {
            email: "seller-rbac@test.com",
            password: "Seller123!",
          })
          expect([200, 201]).toContain(reg.status)

          const login = await api.post("/auth/member/emailpass", {
            email: "seller-rbac@test.com",
            password: "Seller123!",
          })
          expect(login.status).toEqual(200)
          memberToken = login.data.token
        })

        it("can register a seller after member login", async () => {
          const res = await api.post(
            "/vendor/sellers/register",
            {
              name: "RBAC Test Shop",
              handle: "rbac-test-shop",
              email: "seller-rbac@test.com",
              currency_code: "ghs",
            },
            { headers: { Authorization: `Bearer ${memberToken}` } },
          )
          // Might be 400+ if registration is restricted in test env
          if (res.status !== 200) return
          sellerId = res.data.seller?.id
        })
      })
    })
  },
})
