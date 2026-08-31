import type { AuthRepository } from "./auth-repository"
import type { CatalogRepository } from "./catalog-repository"
import type { ApiEnv } from "./env"
import type { SessionClaims } from "./lib/jwt"

export type AppEnv = {
  Bindings: ApiEnv
  Variables: {
    repo: CatalogRepository
    authRepo: AuthRepository
    jwtSecret: string
    auth: SessionClaims
  }
}
