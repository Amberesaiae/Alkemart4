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
import { autoPaySeller } from "./lib/payouts"
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
  RefundPaystackTransaction,
  VerifyPaystackTransfer,
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
import { adminSettings } from "./routes/admin/settings"
import { adminReturns } from "./routes/admin/returns"
import { vendorReturns } from "./routes/vendor/returns"
import { storeProtection } from "./routes/store/protection"
import { storeMessages } from "./routes/store/messages"
import { storeCompare } from "./routes/store/compare"
import { storeQuestions } from "./routes/store/questions"
import { vendorMessages } from "./routes/vendor/messages"
import { adminMessages } from "./routes/admin/messages"
import { runReturnDeadlines } from "./lib/returns"
import { adminBusiness } from "./routes/admin/business"
import { vendorBusiness } from "./routes/vendor/business"
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
import { storeAccount } from "./routes/store/account"
import { storeSitemap } from "./routes/store/sitemap"
import { storeSubscriptions } from "./routes/store/subscriptions"
import { storeHomepage } from "./routes/store/homepage"
import { storeGeo } from "./routes/store/geo"
import { storePlaces } from "./routes/store/places"
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
import { InMemoryAccountStore, PostgresAccountStore, type AccountStore } from "./account-store"
import { InMemoryListingReviewStore, PostgresListingReviewStore, type ListingReviewStore } from "./listing-reviews"
import { InMemorySettingsStore, PostgresSettingsStore, type SettingsStore } from "./settings-store"
import { InMemoryStatementStore, PostgresStatementStore, type StatementStore } from "./statement-store"
import { InMemoryMessagesStore, PostgresMessagesStore, type MessagesStore } from "./messages-store"
import { InMemoryCompareStore, PostgresCompareStore, type CompareStore } from "./compare-store"
import { InMemoryDealsStore, PostgresDealsStore, type DealsStore } from "./deals-store"
import { InMemoryVideosStore, PostgresVideosStore, type VideosStore } from "./videos-store"
import { vendorCatalogue } from "./routes/vendor/catalogue"
import { vendorVideos } from "./routes/vendor/videos"
import { storeVideos } from "./routes/store/videos"
import { adminVideos } from "./routes/admin/videos"
// Phase 6 routes are built but not mounted until proven (see PILOT-PLAN.md).
void [vendorCatalogue, vendorVideos, storeVideos, adminVideos]
import { storeDeals } from "./routes/store/deals"
import { vendorDeals } from "./routes/vendor/deals"
import { emailProviderFromEnv } from "./email"
import { InMemoryNewsletterStore, PostgresNewsletterStore } from "./newsletter"
import { storeNewsletter } from "./routes/store/newsletter"

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
    accountStore?: AccountStore
    reviewStore?: ListingReviewStore
    settingsStore?: SettingsStore
    statementStore?: StatementStore
    messagesStore?: MessagesStore
    compareStore?: CompareStore
    dealsStore?: DealsStore
    videosStore?: VideosStore
    jwtSecret?: string
    paystackSecretKey?: string
    createPaystackTransferRecipient?: CreatePaystackTransferRecipient
    createPaystackTransfer?: CreatePaystackTransfer
    verifyPaystackTransfer?: VerifyPaystackTransfer
    refundPaystackTransaction?: RefundPaystackTransaction
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
  const fallbackReviews = options.reviewStore ?? (options.repo ? new InMemoryListingReviewStore() : undefined)
  const fallbackSettings = options.settingsStore ?? (options.repo || options.checkoutRepo ? new InMemorySettingsStore() : undefined)
  const fallbackStatements = options.statementStore ?? (options.repo || options.checkoutRepo ? new InMemoryStatementStore() : undefined)
  const fallbackCompare = options.compareStore ?? (options.repo || options.checkoutRepo ? new InMemoryCompareStore() : undefined)
  const fallbackMessages = options.messagesStore ?? (options.repo || options.checkoutRepo ? new InMemoryMessagesStore() : undefined)
  const fallbackVideos = options.videosStore ?? (options.repo || options.checkoutRepo ? new InMemoryVideosStore() : undefined)
  const fallbackDeals = options.dealsStore ?? (options.repo || options.checkoutRepo ? new InMemoryDealsStore() : undefined)
  const fallbackAccounts = options.accountStore ?? (options.authRepo ? new InMemoryAccountStore() : undefined)
  const fallbackNewsletter = options.authRepo ? new InMemoryNewsletterStore() : undefined
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
    c.set("reviews", fallbackReviews ?? lazy(() => new PostgresListingReviewStore(primaryOf(c))))
    await next()
  }

  const bindCheckout: MiddlewareHandler<AppEnv> = async (c, next) => {
    c.set("settings", fallbackSettings ?? lazy(() => new PostgresSettingsStore(primaryOf(c))))
    c.set("statements", fallbackStatements ?? lazy(() => new PostgresStatementStore(primaryOf(c))))
    c.set("messages", fallbackMessages ?? lazy(() => new PostgresMessagesStore(primaryOf(c))))
    c.set("compare", fallbackCompare ?? lazy(() => new PostgresCompareStore(primaryOf(c))))
    c.set("deals", fallbackDeals ?? lazy(() => new PostgresDealsStore(primaryOf(c))))
    c.set("videos", fallbackVideos ?? lazy(() => new PostgresVideosStore(primaryOf(c))))
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
        const email = emailProviderFromEnv({
          RESEND_API_KEY: raw.RESEND_API_KEY as string | undefined,
          EMAIL_FROM: raw.EMAIL_FROM as string | undefined,
          EMAIL_REPLY_TO: raw.EMAIL_REPLY_TO as string | undefined,
        })
        c.set("jobs", inlineJobProducer(async () => ({ checkout, sms, email })))
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
    if (options.verifyPaystackTransfer) c.set("verifyPaystackTransfer", options.verifyPaystackTransfer)
    if (options.refundPaystackTransaction) c.set("refundPaystackTransaction", options.refundPaystackTransaction)
    if (options.paystackSecretKey !== undefined) {
      c.set("paystackSecretKey", options.paystackSecretKey)
    } else if (!options.checkoutRepo && !(options.repo instanceof InMemoryCatalogRepository) && !options.authRepo) {
      // Injected test repositories mean a test app: no Worker env to parse.
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

  /**
   * Just the session secret, for routes that only need to recognise an
   * optional signed-in buyer (the cart shows accepted offer prices). Never
   * fails the request: no secret simply means "not signed in".
   */
  const bindSessionSecret: MiddlewareHandler<AppEnv> = async (c, next) => {
    try {
      c.set("jwtSecret", options.jwtSecret ?? envOf(c).JWT_SECRET)
    } catch {
      /* no env in this app (tests) — treat every caller as a guest */
    }
    await next()
  }

  const bindAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (options.authRepo) {
      c.set("authRepo", options.authRepo)
    } else {
      c.set("authRepo", lazy(() => new PostgresAuthRepository(primaryOf(c))))
    }
    c.set("accounts", options.accountStore ?? fallbackAccounts ?? lazy(() => new PostgresAccountStore(primaryOf(c))))
    c.set("newsletter", fallbackNewsletter ?? lazy(() => new PostgresNewsletterStore(primaryOf(c))))
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
  store.route("/auth", withBind(bindAuth, withBind(bindCheckout, withBind(noStoreHeaders, storeAuth))))
  store.route("/account", withBind(bindAuth, withBind(bindCheckout, withBind(noStoreHeaders, storeAccount))))
  store.route("/newsletter", withBind(bindAuth, withBind(bindCheckout, withBind(noStoreHeaders, storeNewsletter))))
  store.route("/geo", withBind(noStoreHeaders, storeGeo))
  store.route("/places", storePlaces)
  store.route("/categories", withBind(bindCatalog, categories))
  store.route("/catalog", withBind(bindCatalog, withBind(bindCheckout, catalog)))
  store.route("/search", withBind(bindCatalog, storeSearch))
  store.route("/products", withBind(bindCatalog, withBind(bindCheckout, products)))
  store.route("/sellers", withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, sellers))))
  store.route("/homepage", withBind(bindAuth, withBind(bindCatalog, storeHomepage)))
  store.route("/cart", withBind(bindSessionSecret, withBind(bindCheckout, withBind(noStoreHeaders, storeCart))))
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
  store.route("/protection", withBind(bindCheckout, storeProtection))
  store.route("/messages", withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, withBind(noStoreHeaders, storeMessages)))))
  // ⚖ Compare is held back for the first deploy (owner, 2026-09-27): built and
  // tested, not mounted. Mount it and flip COMPARE_ENABLED in the storefront.
  void storeCompare
  // Make an offer — parked by the owner (2026-09-27); code kept, not mounted.
  void storeDeals
  // Phase 6 (paused for the MVP, not yet proven): store.route("/videos", withBind(bindCatalog, withBind(bindCheckout, storeVideos)))
  store.route("/questions", withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, storeQuestions))))
  store.route(
    "/orders",
    withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, withBind(noStoreHeaders, storeOrders)))),
  )
  app.route("/store", store)

  const vendor = new Hono<AppEnv>()
  vendor.use("*", bindAuth)
  vendor.use("*", noStoreHeaders)
  vendor.route("/auth", withBind(bindCheckout, vendorAuth))
  vendor.route("/onboarding", vendorOnboarding)
  vendor.route("/products", withBind(bindCatalog, withBind(bindCheckout, vendorProducts)))
  vendor.route("/collections", withBind(bindCatalog, vendorCollections))
  vendor.route("/imports", withBind(bindCatalog, vendorImports))
  vendor.route("/payouts", withBind(bindCheckout, vendorPayouts))
  vendor.route("/business", withBind(bindCheckout, vendorBusiness))
  vendor.route("/preferences", withBind(bindCheckout, vendorPreferences))
  vendor.route("/orders", withBind(bindCheckout, vendorOrders))
  vendor.route("/returns", withBind(bindAuth, withBind(bindCheckout, vendorReturns)))
  // Phase 6 (paused for the MVP, not yet proven): vendor.route("/catalogue", withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, vendorCatalogue))))
  // Phase 6 (paused for the MVP, not yet proven): vendor.route("/videos", withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, vendorVideos))))
  void vendorDeals
  vendor.route("/messages", withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, vendorMessages))))
  vendor.route("/reviews", withBind(bindCheckout, vendorReviews))
  vendor.route("/uploads", vendorUploads)
  vendor.route("/sellers", withBind(bindCatalog, vendorSellers))
  vendor.route("/health", withBind(bindCatalog, withBind(bindCheckout, vendorHealth)))
  vendor.route("/tasks", withBind(bindCatalog, withBind(bindCheckout, vendorTasks)))
  vendor.route("/stats/shop", withBind(bindCatalog, withBind(bindCheckout, vendorShopStats)))
  vendor.get("/me", requireSeller, (c) => {
    // Claims minus the issued-at stamp: the session contract is id + role (+ seller).
    const { iat: _iat, ...claims } = c.get("auth")
    void _iat
    return c.json(claims)
  })
  app.route("/vendor", vendor)

  const admin = new Hono<AppEnv>()
  admin.use("*", bindAuth)
  admin.use("*", noStoreHeaders)
  admin.route("/auth", adminAuth)
  admin.get("/me", requireAdmin, (c) => {
    // Claims minus the issued-at stamp: the session contract is id + role (+ seller).
    const { iat: _iat, ...claims } = c.get("auth")
    void _iat
    return c.json(claims)
  })
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
  admin.route("/settings", withBind(bindCheckout, adminSettings))
  admin.route("/returns", withBind(bindAuth, withBind(bindCheckout, adminReturns)))
  // Phase 6 (paused for the MVP, not yet proven): admin.route("/videos", withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, adminVideos))))
  admin.route("/messages", withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, adminMessages))))
  admin.route("/business", withBind(bindCheckout, adminBusiness))
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
  // Holds first: "/payouts/:id" would otherwise swallow "/payouts/holds".
  admin.route(
    "/payouts/holds",
    withBind(bindAuth, withBind(bindCheckout, adminPayoutHolds)),
  )
  admin.route(
    "/payouts",
    withBind(bindAuth, withBind(bindCheckout, adminPayouts)),
  )
  app.route("/admin", admin)

  app.route("/hooks/paystack", withBind(bindAuth, withBind(bindCheckout, withBind(noStoreHeaders, paystackHooks))))

  app.get("/media/*", (c) => serveMedia(c))

  return app
}

const app = createApp()

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: unknown, ctx: ExecutionContext) {
    await runPaymentIntentExpiry(event, env, ctx)
    await runNotificationDispatch(event, env, ctx)
    await runReturnDeadlines(env)
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
    const email = emailProviderFromEnv({
      RESEND_API_KEY: parsed.RESEND_API_KEY,
      EMAIL_FROM: parsed.EMAIL_FROM,
      EMAIL_REPLY_TO: parsed.EMAIL_REPLY_TO,
    })
    const raw = (env ?? {}) as Record<string, unknown>
    const expiryQ = raw[JOB_QUEUE_BINDINGS.expiry] as QueueLike | undefined
    const notificationsQ = raw[JOB_QUEUE_BINDINGS.notifications] as QueueLike | undefined
    const jobs = expiryQ && notificationsQ ? cfJobProducer({ expiry: expiryQ, notifications: notificationsQ }) : undefined
    const secretKey = parsed.PAYSTACK_SECRET_KEY
    const authRepo = new PostgresAuthRepository(primaryDb(parsed))
    const autoPay = secretKey ? (sellerId: string) => autoPaySeller({ checkout, secretKey, authRepo }, sellerId) : undefined
    for (const msg of batch.messages) {
      try {
        await consumeJobMessage(
          {
            checkout,
            sms,
            email,
            jobs,
            autoPay,
            paystackSecretKey: parsed.PAYSTACK_SECRET_KEY,
            emailLinks: {
              storefrontUrl: parsed.STOREFRONT_URL ?? null,
              vendorUrl: parsed.VENDOR_URL ?? null,
            },
          },
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
