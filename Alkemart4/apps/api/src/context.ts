import type { PaystackConfig } from "@alkemart/paystack"
import type { AuthRepository } from "./auth-repository"
import type { CatalogRepository } from "./catalog-repository"
import type { ApiEnv } from "./env"
import type { SessionClaims } from "./lib/jwt"

export type CreatePaystackTransferRecipient = (
  cfg: PaystackConfig,
  input: {
    name: string
    accountNumber: string
    bankCode: string
    currency?: "GHS"
  },
) => Promise<{ recipientCode: string }>

export type AppEnv = {
  Bindings: ApiEnv
  Variables: {
    repo: CatalogRepository
    authRepo: AuthRepository
    jwtSecret: string
    auth: SessionClaims
    paystackSecretKey?: string
    createPaystackTransferRecipient: CreatePaystackTransferRecipient
  }
}
