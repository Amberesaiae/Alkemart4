import { createPaystackTransferRecipient } from "@alkemart/paystack"
import { Hono, type MiddlewareHandler } from "hono"
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
import { adminAuth } from "./routes/admin/auth"
import { adminMigrate } from "./routes/admin/migrate"
import { adminOrders } from "./routes/admin/orders"
import { adminPayouts } from "./routes/admin/payouts"
import { adminProducts } from "./routes/admin/products"
import { adminSellers } from "./routes/admin/sellers"
import { health } from "./routes/health"
import { storeAuth } from "./routes/store/auth"
import { storeCart } from "./routes/store/cart"
import { catalog } from "./routes/store/catalog"
import { categories } from "./routes/store/categories"
import { storeCheckout } from "./routes/store/checkout"
import { storeOrders } from "./routes/store/orders"
import { products } from "./routes/store/products"
import { sellers } from "./routes/store/sellers"
import { paystackHooks } from "./routes/hooks/paystack"
import { vendorAuth } from "./routes/vendor/auth"
import { vendorOnboarding } from "./routes/vendor/onboarding"
import { vendorOrders } from "./routes/vendor/orders"
import { vendorProducts } from "./routes/vendor/products"

export function createApp(
  options: {
    repo?: CatalogRepository
    authRepo?: AuthRepository
    checkoutRepo?: CheckoutRepository
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

  const bindCatalog: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (options.repo) {
      c.set("repo", options.repo)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      // Catalog mutations + read-after-write go through HYPERDRIVE_PRIMARY (writeDb);
      // pure catalog reads keep using the (cached) HYPERDRIVE binding. See ACID-DATAFLOW.md.
      c.set("repo", new PostgresCatalogRepository(catalogDb(env), primaryDb(env)))
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
    } else if (!options.checkoutRepo) {
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
  store.route("/catalog", withBind(bindCatalog, catalog))
  store.route("/products", withBind(bindCatalog, products))
  store.route("/sellers", withBind(bindCatalog, sellers))
  store.route("/cart", withBind(bindCheckout, storeCart))
  store.route("/checkout", withBind(bindCheckout, storeCheckout))
  store.route(
    "/orders",
    withBind(bindAuth, withBind(bindCheckout, storeOrders)),
  )
  app.route("/store", store)

  const vendor = new Hono<AppEnv>()
  vendor.use("*", bindAuth)
  vendor.route("/auth", vendorAuth)
  vendor.route("/onboarding", vendorOnboarding)
  vendor.route("/products", withBind(bindCatalog, vendorProducts))
  vendor.route("/orders", withBind(bindCheckout, vendorOrders))
  vendor.get("/me", requireSeller, (c) => c.json(c.get("auth")))
  app.route("/vendor", vendor)

  const admin = new Hono<AppEnv>()
  admin.use("*", bindAuth)
  admin.route("/auth", adminAuth)
  admin.get("/me", requireAdmin, (c) => c.json(c.get("auth")))
  admin.route("/sellers", adminSellers)
  admin.route("/products", withBind(bindCatalog, adminProducts))
  admin.route("/orders", withBind(bindCheckout, adminOrders))
  admin.route("/migrate", adminMigrate)
  admin.route(
    "/payouts",
    withBind(bindAuth, withBind(bindCheckout, adminPayouts)),
  )
  app.route("/admin", admin)

  app.route("/hooks/paystack", withBind(bindCheckout, paystackHooks))

  return app
}

export default createApp()
