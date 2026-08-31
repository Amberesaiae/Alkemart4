import { Hono } from "hono"
import type { CatalogRepository } from "./catalog-repository"
import { PostgresCatalogRepository } from "./catalog-repository"
import type { AppEnv } from "./context"
import { catalogDb } from "./db"
import { parseEnv } from "./env"
import { errorHandler } from "./middleware/error"
import { health } from "./routes/health"
import { catalog } from "./routes/store/catalog"
import { categories } from "./routes/store/categories"
import { products } from "./routes/store/products"
import { sellers } from "./routes/store/sellers"

export function createApp(options: { repo?: CatalogRepository } = {}) {
  const app = new Hono<AppEnv>()
  app.onError(errorHandler)
  app.route("/health", health)

  const store = new Hono<AppEnv>()
  store.use("*", async (c, next) => {
    if (options.repo) {
      c.set("repo", options.repo)
    } else {
      const env = parseEnv(c.env as unknown as Record<string, unknown>)
      c.set("repo", new PostgresCatalogRepository(catalogDb(env)))
    }
    await next()
  })
  store.route("/categories", categories)
  store.route("/catalog", catalog)
  store.route("/products", products)
  store.route("/sellers", sellers)
  app.route("/store", store)
  return app
}

export default createApp()
