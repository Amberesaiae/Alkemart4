import { createPaystackTransferRecipient } from "@alkemart/paystack"
import { Hono, type MiddlewareHandler } from "hono"
import { InMemoryAdminAuditLog, PostgresAdminAuditLog, type AdminAuditLog } from "./admin-audit"
import { InMemoryAppealStore, PostgresAppealStore, type AppealStore } from "./appeals"
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
import { catalogDb, primaryDb } from "./db"
import { parseEnv } from "./env"
import { requireAdmin, requireSeller } from "./middleware/auth"
import { corsMiddleware } from "./middleware/cors"
import { errorHandler } from "./middleware/error"
import { securityMiddleware } from "./middleware/security"
import { adminActions } from "./routes/admin/actions"
import { adminAppeals } from "./routes/admin/appeals"
import { adminReviews } from "./routes/admin/reviews"
import { adminAuth } from "./routes/admin/auth"
import { adminMigrate } from "./routes/admin/migrate"
import { adminOrders } from "./routes/admin/orders"
import { adminPayouts } from "./routes/admin/payouts"
import { adminProducts } from "./routes/admin/products"
import { adminSellers } from "./routes/admin/sellers"
import { adminStats, adminTrafficStats } from "./routes/admin/stats"
import { adminHomepage } from "./routes/admin/homepage"
import { health } from "./routes/health"
import { storeAuth } from "./routes/store/auth"
import { storeCart } from "./routes/store/cart"
import { catalog } from "./routes/store/catalog"
import { categories } from "./routes/store/categories"
import { storeCheckout } from "./routes/store/checkout"
import { storeOrders } from "./routes/store/orders"
import { storeReviews } from "./routes/store/reviews"
import { products } from "./routes/store/products"
import { sellers } from "./routes/store/sellers"
import { storeHomepage } from "./routes/store/homepage"
import { paystackHooks } from "./routes/hooks/paystack"
import { vendorAuth } from "./routes/vendor/auth"
import { vendorOnboarding } from "./routes/vendor/onboarding"
import { vendorOrders } from "./routes/vendor/orders"
import { vendorProducts } from "./routes/vendor/products"
import { vendorHealth } from "./routes/vendor/health"
import { vendorSellers } from "./routes/vendor/sellers"
import { vendorShopStats } from "./routes/vendor/stats"
import { vendorReviews } from "./routes/vendor/reviews"
import { vendorTasks } from "./routes/vendor/tasks"
import { adminUploads, serveMedia, vendorUploads } from "./routes/vendor/uploads"
import { runPaymentIntentExpiry } from "./payment-intent-expiry"
import { runNotificationDispatch } from "./notifications-dispatch"

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
    jwtSecret?: string
    paystackSecretKey?: string
    createPaystackTransferRecipient?: CreatePaystackTransferRecipient
    createPaystackTransfer?: CreatePaystackTransfer
    chargePaystackMobileMoney?: ChargePaystackMobileMoney
    initializePaystackTransaction?: InitializePaystackTransaction
    verifyPaystackTransaction?: VerifyPaystackTransaction
    webhookDedup?: WebhookDedup
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

  const bindCatalog: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (options.repo) {
      c.set("repo", options.repo)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      // Catalog mutations + read-after-write go through HYPERDRIVE_PRIMARY (writeDb);
      // pure catalog reads keep using the (cached) HYPERDRIVE binding. See ACID-DATAFLOW.md.
      c.set("repo", new PostgresCatalogRepository(catalogDb(env), primaryDb(env)))
    }
    if (options.trafficStore) {
      c.set("traffic", options.trafficStore)
    } else if (fallbackTraffic) {
      c.set("traffic", fallbackTraffic)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("traffic", new PostgresTrafficStore(primaryDb(env)))
    }
    if (options.appealStore) {
      c.set("appeals", options.appealStore)
    } else if (fallbackAppeals) {
      c.set("appeals", fallbackAppeals)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("appeals", new PostgresAppealStore(primaryDb(env)))
    }
    if (options.policyStore) {
      c.set("policies", options.policyStore)
    } else if (fallbackPolicies) {
      c.set("policies", fallbackPolicies)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("policies", new PostgresShopPolicyStore(primaryDb(env)))
    }
    if (options.featuredStore) {
      c.set("featured", options.featuredStore)
    } else if (fallbackFeatured) {
      c.set("featured", fallbackFeatured)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("featured", new PostgresShopFeaturedStore(primaryDb(env)))
    }
    if (options.homepageStore) {
      c.set("homepage", options.homepageStore)
    } else if (fallbackHomepage) {
      c.set("homepage", fallbackHomepage)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("homepage", new PostgresHomepageContentStore(primaryDb(env)))
    }
    await next()
  }

  const bindCheckout: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (options.checkoutRepo) {
      c.set("checkoutRepo", options.checkoutRepo)
    } else if (options.repo instanceof InMemoryCatalogRepository) {
      c.set("checkoutRepo", new InMemoryCheckoutRepository(options.repo.snapshot()))
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("checkoutRepo", new PostgresCheckoutRepository(primaryDb(env)))
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
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("paystackSecretKey", env.PAYSTACK_SECRET_KEY)
    }
    // KV webhook dedup when binding present (production Worker)
    const rawEnv = c.env as unknown as {
      CATALOG_KV?: {
        get(k: string): Promise<string | null>
        put(k: string, v: string): Promise<void>
      }
    }
    if (!options.webhookDedup && rawEnv?.CATALOG_KV) {
      c.set("webhookDedup", {
        get: (k) => rawEnv.CATALOG_KV!.get(k),
        put: (k, v) => rawEnv.CATALOG_KV!.put(k, v),
      })
    }
    await next()
  }

  const bindAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (options.authRepo) {
      c.set("authRepo", options.authRepo)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("authRepo", new PostgresAuthRepository(primaryDb(env)))
    }
    if (options.auditLog) {
      c.set("auditLog", options.auditLog)
    } else if (fallbackAuditLog) {
      c.set("auditLog", fallbackAuditLog)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("auditLog", new PostgresAdminAuditLog(primaryDb(env)))
    }
    if (options.jwtSecret) {
      c.set("jwtSecret", options.jwtSecret)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("jwtSecret", env.JWT_SECRET)
    }
    if (options.paystackSecretKey !== undefined) {
      c.set("paystackSecretKey", options.paystackSecretKey)
    } else if (!options.authRepo) {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("paystackSecretKey", env.PAYSTACK_SECRET_KEY)
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
  store.route("/auth", withBind(bindAuth, storeAuth))
  store.route("/categories", withBind(bindCatalog, categories))
  store.route("/catalog", withBind(bindCatalog, withBind(bindCheckout, catalog)))
  store.route("/products", withBind(bindCatalog, withBind(bindCheckout, products)))
  store.route("/sellers", withBind(bindAuth, withBind(bindCatalog, withBind(bindCheckout, sellers))))
  store.route("/homepage", withBind(bindCatalog, storeHomepage))
  store.route("/cart", withBind(bindCheckout, storeCart))
  store.route("/checkout", withBind(bindAuth, withBind(bindCheckout, storeCheckout)))
  store.route("/reviews", withBind(bindCheckout, storeReviews))
  store.route(
    "/orders",
    withBind(bindAuth, withBind(bindCheckout, storeOrders)),
  )
  app.route("/store", store)

  const vendor = new Hono<AppEnv>()
  vendor.use("*", bindAuth)
  vendor.route("/auth", vendorAuth)
  vendor.route("/onboarding", vendorOnboarding)
  vendor.route("/products", withBind(bindCatalog, withBind(bindCheckout, vendorProducts)))
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
  admin.route("/auth", adminAuth)
  admin.get("/me", requireAdmin, (c) => c.json(c.get("auth")))
  admin.route("/sellers", withBind(bindCatalog, withBind(bindCheckout, adminSellers)))
  admin.route("/stats", withBind(bindCatalog, withBind(bindCheckout, adminStats)))
  admin.route("/stats/traffic", withBind(bindCatalog, adminTrafficStats))
  admin.route("/products", withBind(bindCatalog, adminProducts))
  admin.route("/orders", withBind(bindCheckout, adminOrders))
  admin.route("/migrate", adminMigrate)
  admin.route("/actions", adminActions)
  admin.route("/uploads", adminUploads)
  admin.route("/homepage", withBind(bindCatalog, adminHomepage))
  admin.route("/appeals", withBind(bindCatalog, adminAppeals))
  admin.route("/reviews", withBind(bindAuth, withBind(bindCheckout, adminReviews)))
  admin.route(
    "/payouts",
    withBind(bindAuth, withBind(bindCheckout, adminPayouts)),
  )
  app.route("/admin", admin)

  app.route("/hooks/paystack", withBind(bindCheckout, paystackHooks))

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
}
