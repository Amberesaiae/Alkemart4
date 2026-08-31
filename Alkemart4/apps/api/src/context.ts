import type { ApiEnv } from "./env"
import type { CatalogRepository } from "./catalog-repository"

export type AppEnv = {
  Bindings: ApiEnv
  Variables: { repo: CatalogRepository }
}
