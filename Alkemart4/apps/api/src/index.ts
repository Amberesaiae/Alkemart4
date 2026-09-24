import { createPaystackTransferRecipient } from "@alkemart/paystack"
import { Hono, type MiddlewareHandler } from "hono"
import { InMemoryAdminAuditLog, PostgresAdminAuditLog, type AdminAuditLog } from "./admin-audit"
import { InMemoryAppealStore, PostgresAppealStore, type AppealStore } from "./appeals"
import {
  InMemoryCollectionsStore,
  PostgresCollectionsStore,
  type CollectionsStore,
} from "./collections"
import {
  InMemoryCampaignStore,
  PostgresCampaignStore,
  type CampaignStore,
} from "./campaigns"
import {
  InMemoryGuideStore,
  PostgresGuideStore,
  type GuideStore,
} from "./guides"
import {
  InMemoryImportBatchStore,
  PostgresImportBatchStore,
  type ImportBatchStore,
} from "./import-batches"
import { InMemoryShopFeaturedStore, PostgresShopFeaturedStore, type ShopFeaturedStore } from "./shop-featured"
import { InMemoryHomepageContentStore, PostgresHomepageContentStore, type HomepageContentStore } from "./homepage-content"
import { InMemoryShopPolicyStore, PostgresShopPolicyStore, type ShopPolicyStore } from "./shop-policies"
import { InMemoryTrafficStore, PostgresTrafficStore, type TrafficStore } from "./traffic"
import { PostgresAuthRepository, type AuthRepository } from "./auth-repository"
import {
  InMemoryCatalogRepository,
  PostgresCatalogRepository,
  type CatalogRepository,
} from "./catalog-repository"
import {
  InMemoryCheckoutRepository,
  type CheckoutRepository,
} from "./checkout-repository"
import { PostgresCheckoutRepository } from "./postgres-checkout-repository"
import type {
  AppEnv,
  ChargePaystackMobileMoney,
  CreatePaystackTransfer,
  CreatePaystackTransferRecipient,
  InitializePaystackTransaction,
  VerifyPaystackTransaction,
  WebhookDedup,
} from "./context"
import { primaryDb } from "./db"
import { parseEnv } from "./env"
import { catalogOf, envOf, lazy, primaryOf } from "./lib/request-scope"
import { noStoreHeaders } from "./lib/edge-cache"
import { requireAdmin, requireSeller } from "./middleware/auth"
import { corsMiddleware } from "./middleware/cors"
import { errorHandler } from "./middleware/error"
import { securityMiddleware } from "./middleware/security"
import { adminActions } from "./routes/admin/actions"
import { adminAliases, adminSearch } from "./routes/admin/aliases"
import { adminAppeals } from "./routes/admin/appeals"
import { adminAttributes } from "./routes/admin/attributes"
import { adminMatches } from "./routes/admin/matches"
import { adminReviews } from "./routes/admin/reviews"
import { adminFeed } from "./routes/admin/feed"
import { adminTaxonomy } from "./routes/admin/taxonomy"
import { adminAuth } from "./routes/admin/auth"
import { adminMigrate } from "./routes/admin/migrate"
import { adminOrders } from "./routes/admin/orders"
import { adminPayouts, adminPayoutHolds } from "./routes/admin/payouts"
import { adminProducts } from "./routes/admin/products"
import { adminSellers } from "./routes/admin/sellers"
import { adminStats, adminTrafficStats } from "./routes/admin/stats"
import { adminHomepage } from "./routes/admin/homepage"
import { adminCampaigns } from "./routes/admin/campaigns"
import { adminExperiments } from "./routes/admin/experiments"
import { adminGuides } from "./routes/admin/guides"
import { health } from "./routes/health"
import { storeAuth } from "./routes/store/auth"
import { storeSearch } from "./routes/store/search"
import { storeCart } from "./routes/store/cart"
import { catalog } from "./routes/store/catalog"
import { categories } from "./routes/store/categories"
import { storeCheckout } from "./routes/store/checkout"
import { storeOrders } from "./routes/store/orders"
import { storeReviews } from "./routes/store/reviews"
import { products } from "./routes/store/products"
import { sellers } from "./routes/store/sellers"
import { storeCollections } from "./routes/store/collections"
import { storeCourse } from "./routes/store/course"
import { storeExperiments } from "./routes/store/experiments"
import { storeFeed } from "./routes/store/feed"
import { storeGuides } from "./routes/store/guides"
import { storePreferences } from "./routes/store/preferences"
import { storeSitemap } from "./routes/store/sitemap"
import { storeSubscriptions } from "./routes/store/subscriptions"
import { storeHomepage } from "./routes/store/homepage"
import { paystackHooks } from "./routes/hooks/paystack"
import { vendorAuth } from "./routes/vendor/auth"
import { vendorOnboarding } from "./routes/vendor/onboarding"
import { vendorOrders } from "./routes/vendor/orders"
import { vendorProducts } from "./routes/vendor/products"
import { vendorCollections } from "./routes/vendor/collections"
import { vendorImports } from "./routes/vendor/imports"
import { vendorPayouts } from "./routes/vendor/payouts"
import { vendorPreferences } from "./routes/vendor/preferences"
import { vendorHealth } from "./routes/vendor/health"
import { vendorSellers } from "./routes/vendor/sellers"
import { vendorShopStats } from "./routes/vendor/stats"
import { vendorReviews } from "./routes/vendor/reviews"
import { vendorTasks } from "./routes/vendor/tasks"
import { adminUploads, serveMedia, vendorUploads } from "./routes/vendor/uploads"
import { runPaymentIntentExpiry } from "./payment-intent-expiry"
import { runNotificationDispatch } from "./notifications-dispatch"
import {
  JOB_QUEUE_BINDINGS,
  cfJobProducer,
  consumeJobMessage,
  inlineJobProducer,
  type JobProducer,
  type QueueLike,
} from "./jobs"
import { smsProviderFromEnv } from "./sms"

export { runNotificationDispatch, runPaymentIntentExpiry }

export function createApp(
  options: {
    repo?: CatalogRepository
    authRepo?: AuthRepository
    checkoutRepo?: CheckoutRepository
    auditLog?: AdminAuditLog
    trafficStore?: TrafficStore
    appealStore?: AppealStore
    policyStore?: ShopPolicyStore
    featuredStore?: ShopFeaturedStore
    homepageStore?: HomepageContentStore
    collectionsStore?: CollectionsStore
    importBatchStore?: ImportBatchStore
    campaignStore?: CampaignStore
    guideStore?: GuideStore
    jwtSecret?: string
    paystackSecretKey?: string
    createPaystackTransferRecipient?: CreatePaystackTransferRecipient
    createPaystackTransfer?: CreatePaystackTransfer
    chargePaystackMobileMoney?: ChargePaystackMobileMoney
    initializePaystackTransaction?: InitializePaystackTransaction
    verifyPaystackTransaction?: VerifyPaystackTransaction
    webhookDedup?: WebhookDedup
    /** Test seam: synchronous producer double. Defaults to queue bindings,
     * else inline-immediate so work is never silently dropped. */
    jobs?: JobProducer
  } = {},
) {
  const app = new Hono<AppEnv>()
  app.onError(errorHandler)
  app.use("*", corsMiddleware)
  app.use("*", securityMiddleware)
  app.route("/health", health)

  // Test-path stores are memoized per app so state survives across requests
  // in a single test (production wrappers are stateless and safe to share).
  const fallbackAuditLog = options.auditLog ?? (options.authRepo ? new InMemoryAdminAuditLog() : undefined)
  const fallbackTraffic = options.trafficStore ?? (options.repo ? new InMemoryTrafficStore() : undefined)
  const fallbackAppeals = options.appealStore ?? (options.repo ? new InMemoryAppealStore() : undefined)
  const fallbackPolicies = options.policyStore ?? (options.repo ? new InMemoryShopPolicyStore() : undefined)
  const fallbackFeatured = options.featuredStore ?? (options.repo ? new InMemoryShopFeaturedStore() : undefined)
  const fallbackHomepage = options.homepageStore ?? (options.repo ? new InMemoryHomepageContentStore() : undefined)
  const inMemoryRepo = options.repo instanceof InMemoryCatalogRepository ? options.repo : undefined
  const fallbackImports = options.importBatchStore ?? (options.repo ? new InMemoryImportBatchStore() : undefined)
  const fallbackGuides = options.guideStore ?? (options.repo ? new InMemoryGuideStore() : undefined)
  const fallbackCampaigns =
    options.campaignStore ??
    (inMemoryRepo
      ? new InMemoryCampaignStore(
          (productId) => inMemoryRepo.snapshot().products.some((p) => p.id === productId),
          (sellerId) => inMemoryRepo.snapshot().sellers.some((s) => s.id === sellerId),
        )
      : undefined)
  const fallbackCollections =
    options.collectionsStore ??
    (inMemoryRepo
      ? new InMemoryCollectionsStore((sellerId, productId) => {
          const snap = inMemoryRepo.snapshot()
          const product = snap.products.find((p) => p.id === productId)
          if (!product) return false
          return (
            product.sellerId === sellerId ||
            snap.offers.some((o) => o.productId === productId && o.sellerId === sellerId)
          )
        })
      : undefined)

  // Stores are bound lazily: a route touches one or two of these, but eager
  // construction opened a Postgres client per store (12-15 per request) while
  // each Hyperdrive config allows only 20 origin connections. See
  // lib/request-scope.ts.
  const bindCatalog: MiddlewareHandler<AppEnv> = async (c, next) => {
    c.set(
      "repo",
      options.repo ?? lazy(() => new PostgresCatalogRepository(catalogOf(c), primaryOf(c))),
    )
    c.set(
      "traffic",
      options.trafficStore ?? fallbackTraffic ?? lazy(() => new PostgresTrafficStore(primaryOf(c))),
    )
    c.set(
      "appeals",
      options.appealStore ?? fallbackAppeals ?? lazy(() => new PostgresAppealStore(primaryOf(c))),
    )
    c.set(
      "policies",
      options.policyStore ?? fallbackPolicies ?? lazy(() => new PostgresShopPolicyStore(primaryOf(c))),
    )
    c.set(
      "featured",
      options.featuredStore ?? fallbackFeatured ?? lazy(() => new PostgresShopFeaturedStore(primaryOf(c))),
    )
    c.set(
      "homepage",
      options.homepageStore ?? fallbackHomepage ?? lazy(() => new PostgresHomepageContentStore(primaryOf(c))),
    )
    c.set(
      "collections",
      options.collectionsStore ?? fallbackCollections ?? lazy(() => new PostgresCollectionsStore(primaryOf(c))),
    )
    c.set(
      "imports",
      options.importBatchStore ?? fallbackImports ?? lazy(() => new PostgresImportBatchStore(primaryOf(c))),
    )
    c.set(
      "campaigns",
      options.campaignStore ?? fallbackCampaigns ?? lazy(() => new PostgresCampaignStore(primaryOf(c))),
    )
    c.set(
      "guides",
      options.guideStore ?? fallbackGuides ?? lazy(() => new PostgresGuideStore(primaryOf(c))),
    )
    await next()
  }

  const bindCheckout: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (options.checkoutRepo) {
      c.set("checkoutRepo", options.checkoutRepo)
    } else if (options.repo instanceof InMemoryCatalogRepository) {
      c.set("checkoutRepo", new InMemoryCheckoutRepository(options.repo.snapshot()))
    } else {
      c.set("checkoutRepo", lazy(() => new PostgresCheckoutRepository(primaryOf(c))))
    }
    // Job producers ride alongside checkout: every produce site already has
    // bindCheckout mounted, so no mount edits are needed anywhere.
    if (options.jobs) {
      c.set("jobs", options.jobs)
    } else {
      const raw = (c.env ?? {}) as Record<string, unknown>
      const expiry = raw[JOB_QUEUE_BINDINGS.expiry] as QueueLike | undefined
      const notifications = raw[JOB_QUEUE_BINDINGS.notifications] as QueueLike | undefined
      if (expiry && notifications) {
        c.set("jobs", cfJobProducer({ expiry, notifications }))
      } else {
        console.warn(
          JSON.stringify({ job: "producer-fallback", mode: "inline-immediate" }),
        )
        const checkout = c.get("checkoutRepo")
        const sms = smsProviderFromEnv({
          AT_USERNAME: raw.AT_USERNAME as string | undefined,
          AT_API_KEY: raw.AT_API_KEY as string | undefined,
          AT_SENDER_ID: raw.AT_SENDER_ID as string | undefined,
        })
        c.set("jobs", inlineJobProducer(async () => ({ checkout, sms })))
      }
    }
    if (options.chargePaystackMobileMoney) {
      c.set("chargePaystackMobileMoney", options.chargePaystackMobileMoney)
    }
    if (options.initializePaystackTransaction) {
      c.set("initializePaystackTransaction", options.initializePaystackTransaction)
    }
    if (options.verifyPaystackTransaction) {
      c.set("verifyPaystackTransaction", options.verifyPaystackTransaction)
    }
    if (options.webhookDedup) {
      c.set("webhookDedup", options.webhookDedup)
    }
    if (options.createPaystackTransfer) {
      c.set("createPaystackTransfer", options.createPaystackTransfer)
    }
    if (options.paystackSecretKey !== undefined) {
      c.set("paystackSecretKey", options.paystackSecretKey)
    } else if (!options.checkoutRepo && !(options.repo instanceof InMemoryCatalogRepository)) {
      c.set("paystackSecretKey", envOf(c).PAYSTACK_SECRET_KEY)
    }
    // KV webhook dedup when binding present (production Worker)
    const rawEnv = c.env as unknown as {
      CATALOG_KV?: {
        get(k: string): Promise<string | null>
        put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void>
      }
    }
    if (!options.webhookDedup && rawEnv?.CATALOG_KV) {
      c.set("webhookDedup", {
        get: (k) => rawEnv.CATALOG_KV!.get(k),
        put: (k, v, o) => rawEnv.CATALOG_KV!.put(k, v, o),
      })
    }
    await next()
  }

  const bindAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (options.authRepo) {
      c.set("authRepo", options.authRepo)
    } else {
      c.set("authRepo", lazy(() => new PostgresAuthRepository(primaryOf(c))))
    }
    if (options.auditLog) {
      c.set("auditLog", options.auditLog)
    } else if (fallbackAuditLog) {
      c.set("auditLog", fallbackAuditLog)
    } else {
      c.set("auditLog", lazy(() => new PostgresAdminAuditLog(primaryOf(c))))
    }
    if (options.jwtSecret) {
      c.set("jwtSecret", options.jwtSecret)
    } else {
      c.set("jwtSecret", envOf(c).JWT_SECRET)
    }
    if (options.paystackSecretKey !== undefined) {
      c.set("paystackSecretKey", options.paystackSecretKey)
    } else if (!options.authRepo) {
      c.set("paystackSecretKey", envOf(c).PAYSTACK_SECRET_KEY)
    }
    c.set(
      "createPaystackTransferRecipient",
      options.createPaystackTransferRecipient ?? createPaystackTransferRecipient,
    )
    await next()
  }

  const withBind = (mw: MiddlewareHandler<AppEnv>, routes: Hono<AppEnv>) => {
    const inner = new Hono<AppEnv>()
    inner.use("*", mw)
    inner.route("/", routes)
    return inner
  }

  const store = new Hono<AppEnv>()
  store.route("/auth", withBind(bindAuth, withBind(noStoreHeaders, storeAuth)))
  store.route("/categories", withBind(bindCatalog, categories))
  store.route("/catalog", withBind(bindCatalog, withBind(bindCheckout, catalog)))
  store.route("/search", withBind(bindCatalog, storeSearch))
  store.route("/products", withBind(bindCatalog, withBind(bindCheckout, products)))
  store.route("/sellers", withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, sellers))))
  store.route("/homepage", withBind(bindCatalog, storeHomepage))
  store.route("/cart", withBind(bindCheckout, withBind(noStoreHeaders, storeCart)))
  store.route("/checkout", withBind(bindAuth, withBind(bindCheckout, withBind(noStoreHeaders, storeCheckout))))
  store.route("/reviews", withBind(bindCheckout, storeReviews))
  store.route("/collections", withBind(bindCatalog, storeCollections))
  store.route("/course", withBind(bindCatalog, withBind(bindCheckout, storeCourse)))
  store.route("/feed", withBind(bindCatalog, storeFeed))
  store.route("/guides", withBind(bindCatalog, storeGuides))
  store.route("/experiments", withBind(bindCheckout, withBind(noStoreHeaders, storeExperiments)))
  store.route("/preferences", withBind(bindAuth, withBind(bindCheckout, withBind(noStoreHeaders, storePreferences))))
  store.route(
    "/subscriptions",
    withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, withBind(noStoreHeaders, storeSubscriptions)))),
  )
  store.route("/sitemap", withBind(bindCatalog, storeSitemap))
  store.route(
    "/orders",
    withBind(bindAuth, withBind(bindCheckout, withBind(noStoreHeaders, storeOrders))),
  )
  app.route("/store", store)

  const vendor = new Hono<AppEnv>()
  vendor.use("*", bindAuth)
  vendor.use("*", noStoreHeaders)
  vendor.route("/auth", vendorAuth)
  vendor.route("/onboarding", vendorOnboarding)
  vendor.route("/products", withBind(bindCatalog, withBind(bindCheckout, vendorProducts)))
  vendor.route("/collections", withBind(bindCatalog, vendorCollections))
  vendor.route("/imports", withBind(bindCatalog, vendorImports))
  vendor.route("/payouts", withBind(bindCheckout, vendorPayouts))
  vendor.route("/preferences", withBind(bindCheckout, vendorPreferences))
  vendor.route("/orders", withBind(bindCheckout, vendorOrders))
  vendor.route("/reviews", withBind(bindCheckout, vendorReviews))
  vendor.route("/uploads", vendorUploads)
  vendor.route("/sellers", withBind(bindCatalog, vendorSellers))
  vendor.route("/health", withBind(bindCatalog, withBind(bindCheckout, vendorHealth)))
  vendor.route("/tasks", withBind(bindCatalog, withBind(bindCheckout, vendorTasks)))
  vendor.route("/stats/shop", withBind(bindCatalog, withBind(bindCheckout, vendorShopStats)))
  vendor.get("/me", requireSeller, (c) => c.json(c.get("auth")))
  app.route("/vendor", vendor)

  const admin = new Hono<AppEnv>()
  admin.use("*", bindAuth)
  admin.use("*", noStoreHeaders)
  admin.route("/auth", adminAuth)
  admin.get("/me", requireAdmin, (c) => c.json(c.get("auth")))
  admin.route("/sellers", withBind(bindCatalog, withBind(bindCheckout, adminSellers)))
  admin.route("/stats", withBind(bindCatalog, withBind(bindCheckout, adminStats)))
  admin.route("/stats/traffic", withBind(bindCatalog, adminTrafficStats))
  admin.route("/products", withBind(bindCatalog, adminProducts))
  admin.route("/taxonomy", withBind(bindCatalog, adminTaxonomy))
  admin.route("/attributes", withBind(bindCatalog, adminAttributes))
  admin.route("/matches", withBind(bindCatalog, adminMatches))
  admin.route("/aliases", withBind(bindCatalog, adminAliases))
  admin.route("/search", withBind(bindCatalog, adminSearch))
  admin.route("/orders", withBind(bindCheckout, adminOrders))
  admin.route("/migrate", adminMigrate)
  admin.route("/actions", adminActions)
  admin.route("/uploads", adminUploads)
  admin.route("/homepage", withBind(bindCatalog, adminHomepage))
  admin.route("/campaigns", withBind(bindAuth, withBind(bindCatalog, adminCampaigns)))
  admin.route("/experiments", withBind(bindAuth, withBind(bindCheckout, adminExperiments)))
  admin.route("/guides", withBind(bindAuth, withBind(bindCatalog, adminGuides)))
  admin.route("/appeals", withBind(bindCatalog, adminAppeals))
  admin.route("/reviews", withBind(bindAuth, withBind(bindCheckout, adminReviews)))
  admin.route("/feed", withBind(bindAuth, withBind(bindCatalog, adminFeed)))
  admin.route(
    "/payouts",
    withBind(bindAuth, withBind(bindCheckout, adminPayouts)),
  )
  admin.route(
    "/payouts/holds",
    withBind(bindAuth, withBind(bindCheckout, adminPayoutHolds)),
  )
  app.route("/admin", admin)

  app.route("/hooks/paystack", withBind(bindCheckout, withBind(noStoreHeaders, paystackHooks)))

  app.get("/media/*", (c) => serveMedia(c))

  return app
}

const app = createApp()

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: unknown, ctx: ExecutionContext) {
    await runPaymentIntentExpiry(event, env, ctx)
    await runNotificationDispatch(event, env, ctx)
  },
  /**
   * Queue consumer (agnostic plan Phase 2). Per-message ack after idempotent
   * commit; a throw rides retries into the DLQ. Already-acked siblings in a
   * failed batch are never redelivered (first-call-wins precedence).
   */
  async queue(
    batch: { messages: { body: unknown; attempts: number; ack: () => void; retry: (opts?: { delaySeconds?: number }) => void }[] },
    env: unknown,
  ) {
    const parsed = parseEnv(env as Record<string, unknown>)
    const checkout = new PostgresCheckoutRepository(primaryDb(parsed))
    const sms = smsProviderFromEnv({
      AT_USERNAME: parsed.AT_USERNAME,
      AT_API_KEY: parsed.AT_API_KEY,
      AT_SENDER_ID: parsed.AT_SENDER_ID,
    })
    for (const msg of batch.messages) {
      try {
        await consumeJobMessage(
          { checkout, sms },
          msg.body,
          { attempts: msg.attempts, ack: () => msg.ack(), retry: (opts) => msg.retry(opts) },
        )
      } catch (error) {
        // Implicit retry → DLQ after max_retries. Per-message acks above keep
        // converged siblings out of the redelivery.
        console.error(
          JSON.stringify({
            job: "consume-failed",
            attempts: msg.attempts,
            error: error instanceof Error ? error.message : String(error),
          }),
        )
        throw error
      }
    }
  },
}
