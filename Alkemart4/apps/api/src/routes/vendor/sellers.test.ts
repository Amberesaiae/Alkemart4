import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryShopPolicyStore } from "../../shop-policies"
import type { ApiEnv } from "../../env"
import { createApp } from "../../index"

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

function testEnv(): ApiEnv {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET,
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

function testApp() {
  return createApp({
    authRepo: new InMemoryAuthRepository(),
    jwtSecret: JWT_SECRET,
    paystackSecretKey: "sk_test_x",
    // Mirrors Paystack: only MTN/VOD/ATL are valid Ghana MoMo bank codes.
    createPaystackTransferRecipient: async (cfg, input: { bankCode: string }) => {
      if (!["MTN", "VOD", "ATL"].includes(input.bankCode)) {
        throw new Error("Bank is invalid")
      }
      return { recipientCode: "RC_test_123" }
    },
  })
}

function json(method: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return { method, headers, body: JSON.stringify(body) }
}

async function sellerToken(
  app: ReturnType<typeof createApp>,
  overrides: { email?: string; handle?: string; name?: string } = {},
) {
  const { email = "vendor@alkemart.test", handle = "accra-mart", name = "Accra Mart" } = overrides
  const res = await app.request(
    "/vendor/auth/register",
    json("POST", { email, password: "VendorPass1", sellerName: name, sellerHandle: handle }),
    testEnv(),
  )
  expect(res.status).toBe(201)
  const body = (await res.json()) as { token: string }
  return body.token
}

describe("GET /vendor/sellers/me", () => {
  it("returns the full seller profile for the session seller", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const res = await app.request("/vendor/sellers/me", { headers: { Authorization: `Bearer ${token}` } }, testEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { seller: Record<string, unknown> }
    expect(body.seller.handle).toBe("accra-mart")
    expect(body.seller.name).toBe("Accra Mart")
    expect(body.seller.email).toBe("vendor@alkemart.test")
    expect(body.seller.address).toBeNull()
    expect(body.seller.payment_details).toBeNull()
  })

  it("401s without a seller session", async () => {
    const app = testApp()
    const res = await app.request("/vendor/sellers/me", {}, testEnv())
    expect(res.status).toBe(401)
  })
})

describe("POST /vendor/sellers/me", () => {
  it("updates name, handle, description, logo, and banner", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const res = await app.request(
      "/vendor/sellers/me",
      json("POST", {
        name: "Ama Shop",
        handle: "ama-shop",
        description: "Best in Accra",
        logo: "http://127.0.0.1:8787/media/logos/x/y.webp",
        banner: null,
      }, token),
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { seller: Record<string, unknown> }
    expect(body.seller.name).toBe("Ama Shop")
    expect(body.seller.handle).toBe("ama-shop")
    expect(body.seller.description).toBe("Best in Accra")
    expect(body.seller.logo).toContain("/media/logos/")
  })

  it("409s on a taken handle and 400s on invalid bodies", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    await sellerToken(app, { email: "other@alkemart.test", handle: "other-shop", name: "Other" })

    const clash = await app.request("/vendor/sellers/me", json("POST", { handle: "other-shop" }, token), testEnv())
    expect(clash.status).toBe(409)

    const badHandle = await app.request("/vendor/sellers/me", json("POST", { handle: "Bad Handle!" }, token), testEnv())
    expect(badHandle.status).toBe(400)

    const empty = await app.request("/vendor/sellers/me", json("POST", {}, token), testEnv())
    expect(empty.status).toBe(400)
  })
})

describe("POST /vendor/sellers/me/address", () => {
  it("stores region, digital address, fee, and street extras", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const res = await app.request(
      "/vendor/sellers/me/address",
      json("POST", {
        pack_region: "Greater Accra",
        digital_address: "GA-123-4567",
        delivery_fee_pesewas: "1500",
        address_1: "12 Oxford Street",
        city: "Accra",
      }, token),
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { seller: Record<string, Record<string, unknown> | string | null> }
    const address = body.seller.address as Record<string, unknown>
    expect(address.province).toBe("Greater Accra")
    expect(address.postal_code).toBe("GA-123-4567")
    expect(address.address_1).toBe("12 Oxford Street")
    expect(address.city).toBe("Accra")
    const meta = body.seller.metadata as Record<string, unknown>
    expect(meta.delivery_fee_ghs).toBe(15)
  })
})

describe("POST /vendor/sellers/me/payment-details", () => {
  it("creates a Paystack recipient and stores MoMo details", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const res = await app.request(
      "/vendor/sellers/me/payment-details",
      json("POST", { provider: "mtn", phone: "0241234567" }, token),
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { seller: { payment_details: { type: string; provider: string; phone: string } } }
    expect(body.seller.payment_details).toEqual({ type: "momo", provider: "mtn", phone: "0241234567" })

    const me = await app.request("/vendor/sellers/me", { headers: { Authorization: `Bearer ${token}` } }, testEnv())
    const meBody = (await me.json()) as { seller: { payment_details: unknown } }
    expect(meBody.seller.payment_details).toEqual({ type: "momo", provider: "mtn", phone: "0241234567" })
  })

  it.each([
    { provider: "mtn", phone: "0241234567" },
    { provider: "vodafone", phone: "0201234567" },
    { provider: "airteltigo", phone: "0261234567" },
  ])("creates a recipient for $provider with a valid bank code", async ({ provider, phone }) => {
    const app = testApp()
    const token = await sellerToken(app)
    const res = await app.request(
      "/vendor/sellers/me/payment-details",
      json("POST", { provider, phone }, token),
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { seller: { payment_details: { provider: string; phone: string } } }
    expect(body.seller.payment_details).toEqual({ type: "momo", provider, phone })
  })

  it("normalizes E.164 numbers to local MSISDN for Paystack", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const res = await app.request(
      "/vendor/sellers/me/payment-details",
      json("POST", { provider: "vodafone", phone: "+233509913229" }, token),
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { seller: { payment_details: { provider: string; phone: string } } }
    expect(body.seller.payment_details).toEqual({ type: "momo", provider: "vodafone", phone: "0509913229" })
  })

  it("400s on invalid provider or phone", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const badProvider = await app.request(
      "/vendor/sellers/me/payment-details",
      json("POST", { provider: "telecel", phone: "0241234567" }, token),
      testEnv(),
    )
    expect(badProvider.status).toBe(400)
    const badPhone = await app.request(
      "/vendor/sellers/me/payment-details",
      json("POST", { provider: "mtn", phone: "123" }, token),
      testEnv(),
    )
    expect(badPhone.status).toBe(400)
  })
})

describe("PATCH /vendor/sellers/me/storefront", () => {
  it("merges tagline + seoDescription and exposes the storefront block on GET /me", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const res = await app.request(
      "/vendor/sellers/me/storefront",
      json("PATCH", { tagline: "Accra's freshest market", seoDescription: "Fresh groceries in Accra" }, token),
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      seller: { storefront: { tagline: string; seoDescription: string; announcement: null; announcementActive: boolean } }
    }
    expect(body.seller.storefront.tagline).toBe("Accra's freshest market")
    expect(body.seller.storefront.announcement).toBeNull()
    expect(body.seller.storefront.announcementActive).toBe(false)

    const me = await app.request(
      "/vendor/sellers/me",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv(),
    )
    expect(me.status).toBe(200)
    const meBody = (await me.json()) as { seller: { storefront: { tagline: string } } }
    expect(meBody.seller.storefront.tagline).toBe("Accra's freshest market")
  })

  it("accepts a valid announcement and marks it active", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const now = Date.now()
    const res = await app.request(
      "/vendor/sellers/me/storefront",
      json(
        "PATCH",
        {
          announcement: {
            text: "Harvest sale this weekend",
            startsAt: new Date(now - 60_000).toISOString(),
            endsAt: new Date(now + 86_400_000).toISOString(),
          },
        },
        token,
      ),
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      seller: { storefront: { announcementActive: boolean; announcement: { text: string } } }
    }
    expect(body.seller.storefront.announcementActive).toBe(true)
    expect(body.seller.storefront.announcement.text).toBe("Harvest sale this weekend")
  })

  it("rejects URLs, scam phrases, and endsAt before startsAt", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const now = Date.now()
    const bad = [
      { tagline: "Visit https://example.com today" },
      { tagline: "Send money to reserve stock" },
      {
        announcement: {
          text: "Sale",
          startsAt: new Date(now + 86_400_000).toISOString(),
          endsAt: new Date(now - 60_000).toISOString(),
        },
      },
    ]
    for (const payload of bad) {
      const res = await app.request("/vendor/sellers/me/storefront", json("PATCH", payload, token), testEnv())
      expect(res.status).toBe(400)
    }
  })

  it("writes bio to the seller description and 401s without a session", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const res = await app.request(
      "/vendor/sellers/me/storefront",
      json("PATCH", { bio: "Family-run market stall since 1998" }, token),
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { seller: { description: string } }
    expect(body.seller.description).toBe("Family-run market stall since 1998")

    const anon = await app.request("/vendor/sellers/me/storefront", json("PATCH", { tagline: "x" }), testEnv())
    expect(anon.status).toBe(401)
  })
})

describe("POST /vendor/sellers/me/pause + /unpause", () => {
  it("pauses with note + until, then unpauses back to open", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const until = new Date(Date.now() + 7 * 86_400_000).toISOString()
    const paused = await app.request(
      "/vendor/sellers/me/pause",
      json("POST", { note: "Stock-taking week", until }, token),
      testEnv(),
    )
    expect(paused.status).toBe(200)
    const pausedBody = (await paused.json()) as {
      seller: { availability: { state: string; pausedUntil: string; note: string } }
    }
    expect(pausedBody.seller.availability.state).toBe("paused")
    expect(pausedBody.seller.availability.note).toBe("Stock-taking week")
    expect(pausedBody.seller.availability.pausedUntil).toBe(new Date(until).toISOString())

    const open = await app.request("/vendor/sellers/me/unpause", json("POST", {}, token), testEnv())
    expect(open.status).toBe(200)
    const openBody = (await open.json()) as {
      seller: { availability: { state: string; pausedUntil: null; note: null } }
    }
    expect(openBody.seller.availability.state).toBe("open")
    expect(openBody.seller.availability.pausedUntil).toBeNull()
  })

  it("400s on past or invalid until dates", async () => {
    const app = testApp()
    const token = await sellerToken(app)
    const past = await app.request(
      "/vendor/sellers/me/pause",
      json("POST", { until: new Date(Date.now() - 1000).toISOString() }, token),
      testEnv(),
    )
    expect(past.status).toBe(400)
    const invalid = await app.request(
      "/vendor/sellers/me/pause",
      json("POST", { until: "not-a-date" }, token),
      testEnv(),
    )
    expect(invalid.status).toBe(400)
  })
})

describe("vendor shop policies", () => {
  function policyApp() {
    return createApp({
      authRepo: new InMemoryAuthRepository(),
      policyStore: new InMemoryShopPolicyStore(),
      jwtSecret: JWT_SECRET,
      paystackSecretKey: "sk_test_x",
      createPaystackTransferRecipient: async () => ({ recipientCode: "RC_test_123" }),
    })
  }

  it("appends versions and exposes current + history", async () => {
    const app = policyApp()
    const token = await sellerToken(app)
    const first = await app.request(
      "/vendor/sellers/me/policies",
      json("POST", { shipping: "Dispatch in 2 days", returnsDays: 7 }, token),
      testEnv(),
    )
    expect(first.status).toBe(201)
    const firstBody = (await first.json()) as { policy: { version: number } }
    expect(firstBody.policy.version).toBe(1)

    const second = await app.request(
      "/vendor/sellers/me/policies",
      json("POST", { shipping: "Dispatch in 2 days", returnsDays: 14, warranty: "6 months" }, token),
      testEnv(),
    )
    expect((await second.json() as { policy: { version: number } }).policy.version).toBe(2)

    const got = await app.request(
      "/vendor/sellers/me/policies",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv(),
    )
    expect(got.status).toBe(200)
    const gotBody = (await got.json()) as {
      current: { version: number; body: { returnsDays: number }; effectiveFrom: string }
      history: { version: number }[]
    }
    expect(gotBody.current.version).toBe(2)
    expect(gotBody.current.body.returnsDays).toBe(14)
    expect(gotBody.history.map((h) => h.version)).toEqual([2, 1])
  })

  it("400s on empty patch and out-of-range returnsDays", async () => {
    const app = policyApp()
    const token = await sellerToken(app)
    const empty = await app.request("/vendor/sellers/me/policies", json("POST", {}, token), testEnv())
    expect(empty.status).toBe(400)
    const bad = await app.request(
      "/vendor/sellers/me/policies",
      json("POST", { returnsDays: 400 }, token),
      testEnv(),
    )
    expect(bad.status).toBe(400)
  })
})

describe("PATCH /vendor/sellers/me/display + /contact + /featured", () => {
  async function displayApp() {
    const { InMemoryCatalogRepository } = await import("../../catalog-repository")
    const { GHANA_CATEGORY_SEED } = await import("@alkemart/db")
    const { InMemoryShopFeaturedStore } = await import("../../shop-featured")
    const snapshot = {
      categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
      sellers: [],
      products: [],
      variants: [],
      offers: [],
    productOptions: [],
    productOptionValues: [],
    variantOptionValues: [],
    }
    const app = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo: new InMemoryCatalogRepository(snapshot),
      featuredStore: new InMemoryShopFeaturedStore(),
      jwtSecret: JWT_SECRET,
      paystackSecretKey: "sk_test_x",
      createPaystackTransferRecipient: async () => ({ recipientCode: "RC_test_123" }),
    })
    return { app, categoryId: "phones" }
  }

  it("saves display prefs and exposes them on GET /me", async () => {
    const { app, categoryId } = await displayApp()
    const token = await sellerToken(app)
    const res = await app.request(
      "/vendor/sellers/me/display",
      json("PATCH", { categoryOrder: [categoryId], featuredCategoryId: categoryId, stockMode: "bands" }, token),
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      seller: { display: { categoryOrder: string[]; featuredCategoryId: string; stockMode: string } }
    }
    expect(body.seller.display).toEqual({ categoryOrder: [categoryId], featuredCategoryId: categoryId, stockMode: "bands" })
  })

  it("400s on unknown categories", async () => {
    const { app } = await displayApp()
    const token = await sellerToken(app)
    const res = await app.request(
      "/vendor/sellers/me/display",
      json("PATCH", { categoryOrder: ["nope"] }, token),
      testEnv(),
    )
    expect(res.status).toBe(400)
  })

  it("saves contact info and rejects bad phone/hours/URLs", async () => {
    const { app } = await displayApp()
    const token = await sellerToken(app)
    const ok = await app.request(
      "/vendor/sellers/me/contact",
      json(
        "PATCH",
        {
          phone: "+233241234567",
          hours: { days: "Mon-Fri", open: "09:00", close: "17:00" },
          social: { instagram: "https://instagram.com/accramart" },
        },
        token,
      ),
      testEnv(),
    )
    expect(ok.status).toBe(200)
    const okBody = (await ok.json()) as {
      seller: { contact: { phone: string; hours: { days: string }; social: { instagram: string } } }
    }
    expect(okBody.seller.contact.phone).toBe("+233241234567")
    expect(okBody.seller.contact.hours.days).toBe("Mon-Fri")
    expect(okBody.seller.contact.social.instagram).toBe("https://instagram.com/accramart")

    for (const payload of [
      { phone: "0241234567" },
      { hours: { days: "Someday", open: "09:00", close: "17:00" } },
      { hours: { days: "Mon-Fri", open: "9am", close: "17:00" } },
      { social: { instagram: "http://evil.example/x" } },
      { social: { instagram: "https://instagram.com.evil.example/x" } },
    ]) {
      const res = await app.request("/vendor/sellers/me/contact", json("PATCH", payload, token), testEnv())
      expect(res.status).toBe(400)
    }
  })

  it("featured shelf allows own products only, max 8", async () => {
    const { InMemoryCatalogRepository } = await import("../../catalog-repository")
    const { GHANA_CATEGORY_SEED } = await import("@alkemart/db")
    const { InMemoryShopFeaturedStore } = await import("../../shop-featured")
    const snapshot = {
      categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
      sellers: [],
      products: [],
      variants: [],
      offers: [],
    productOptions: [],
    productOptionValues: [],
    variantOptionValues: [],
    }
    const repo = new InMemoryCatalogRepository(snapshot)
    const app = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo,
      featuredStore: new InMemoryShopFeaturedStore(),
      jwtSecret: JWT_SECRET,
      paystackSecretKey: "sk_test_x",
      createPaystackTransferRecipient: async () => ({ recipientCode: "RC_test_123" }),
    })
    const token = await sellerToken(app)
    // Create two own products via vendor API.
    const created: string[] = []
    for (const title of ["Koobi One", "Koobi Two"]) {
      const res = await app.request(
        "/vendor/products",
        json(
          "POST",
          { title, primaryCategoryId: "phones", pricePesewas: "1000", onHand: 3 },
          token,
        ),
        testEnv(),
      )
      expect(res.status).toBe(201)
      created.push(((await res.json()) as { product: { id: string } }).product.id)
    }
    const set = await app.request(
      "/vendor/sellers/me/featured",
      { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ productIds: created }) },
      testEnv(),
    )
    expect(set.status).toBe(200)
    expect(((await set.json()) as { productIds: string[] }).productIds).toEqual(created)

    const foreign = await app.request(
      "/vendor/sellers/me/featured",
      { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ productIds: ["prod-nope"] }) },
      testEnv(),
    )
    expect(foreign.status).toBe(400)

    const tooMany = await app.request(
      "/vendor/sellers/me/featured",
      { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ productIds: Array.from({ length: 9 }, (_, i) => `p-${i}`) }) },
      testEnv(),
    )
    expect(tooMany.status).toBe(400)

    const got = await app.request(
      "/vendor/sellers/me/featured",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv(),
    )
    expect(((await got.json()) as { productIds: string[] }).productIds).toEqual(created)
  })
})
