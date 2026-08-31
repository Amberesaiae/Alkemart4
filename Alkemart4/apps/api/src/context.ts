import type { PaystackConfig } from "@alkemart/paystack"
import type { AuthRepository } from "./auth-repository"
import type { CatalogRepository } from "./catalog-repository"
import type { CheckoutRepository } from "./checkout-repository"
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

export type ChargePaystackMobileMoney = (
  cfg: PaystackConfig,
  input: {
    email: string
    amountPesewas: bigint
    phone: string
    provider: "mtn" | "vodafone" | "airteltigo"
    reference: string
  },
) => Promise<{ status: string; reference: string; data: unknown }>

export type InitializePaystackTransaction = (
  cfg: PaystackConfig,
  input: {
    email: string
    amountPesewas: bigint
    reference: string
    callbackUrl: string
  },
) => Promise<{ authorizationUrl: string; reference: string; accessCode: string }>

export type AppEnv = {
  Bindings: ApiEnv
  Variables: {
    repo: CatalogRepository
    authRepo: AuthRepository
    checkoutRepo: CheckoutRepository
    jwtSecret: string
    auth: SessionClaims
    paystackSecretKey?: string
    createPaystackTransferRecipient: CreatePaystackTransferRecipient
    chargePaystackMobileMoney?: ChargePaystackMobileMoney
    initializePaystackTransaction?: InitializePaystackTransaction
  }
}
