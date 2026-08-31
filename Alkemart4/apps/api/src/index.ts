import { Hono, type MiddlewareHandler } from "hono"
import { PostgresAuthRepository, type AuthRepository } from "./auth-repository"
import { PostgresCatalogRepository, type CatalogRepository } from "./catalog-repository"
import type { AppEnv } from "./context"
import { catalogDb, primaryDb } from "./db"
import { parseEnv } from "./env"
import { requireAdmin, requireSeller } from "./middleware/auth"
import { errorHandler } from "./middleware/error"
import { adminAuth } from "./routes/admin/auth"
import { health } from "./routes/health"
import { storeAuth } from "./routes/store/auth"
import { catalog } from "./routes/store/catalog"
import { categories } from "./routes/store/categories"
import { products } from "./routes/store/products"
import { sellers } from "./routes/store/sellers"
import { vendorAuth } from "./routes/vendor/auth"

export function createApp(
  options: { repo?: CatalogRepository; authRepo?: AuthRepository; jwtSecret?: string } = {},
) {
  const app = new Hono<AppEnv>()
  app.onError(errorHandler)
  app.route("/health", health)

  const bindCatalog: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (options.repo) {
      c.set("repo", options.repo)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("repo", new PostgresCatalogRepository(catalogDb(env)))
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
  app.route("/store", store)

  const vendor = new Hono<AppEnv>()
  vendor.use("*", bindAuth)
  vendor.route("/auth", vendorAuth)
  vendor.get("/me", requireSeller, (c) => c.json(c.get("auth")))
  app.route("/vendor", vendor)

  const admin = new Hono<AppEnv>()
  admin.use("*", bindAuth)
  admin.route("/auth", adminAuth)
  admin.get("/me", requireAdmin, (c) => c.json(c.get("auth")))
  app.route("/admin", admin)

  return app
}

export default createApp()
