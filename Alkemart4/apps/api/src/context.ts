import type { PaystackConfig } from "@alkemart/paystack"
import type { AdminAuditLog } from "./admin-audit"
import type { AppealStore } from "./appeals"
import type { CollectionsStore } from "./collections"
import type { ImportBatchStore } from "./import-batches"
import type { CampaignStore } from "./campaigns"
import type { GuideStore } from "./guides"
import type { ShopFeaturedStore } from "./shop-featured"
import type { HomepageContentStore } from "./homepage-content"
import type { ShopPolicyStore } from "./shop-policies"
import type { AuthRepository } from "./auth-repository"
import type { TrafficStore } from "./traffic"
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

export type VerifyPaystackTransaction = (
  cfg: PaystackConfig,
  reference: string,
) => Promise<{ status: string; amount: number; reference: string; raw: unknown }>

export type CreatePaystackTransfer = (
  cfg: PaystackConfig,
  input: {
    amountPesewas: bigint
    recipientCode: string
    reference: string
    reason?: string
  },
) => Promise<{ transferCode: string; reference: string; status: string }>

export type WebhookDedup = {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

export type AppEnv = {
  Bindings: ApiEnv
  Variables: {
    repo: CatalogRepository
    authRepo: AuthRepository
    checkoutRepo: CheckoutRepository
    auditLog: AdminAuditLog
    traffic: TrafficStore
    appeals: AppealStore
    policies: ShopPolicyStore
    featured: ShopFeaturedStore
    homepage: HomepageContentStore
    collections: CollectionsStore
    imports: ImportBatchStore
    campaigns: CampaignStore
    guides: GuideStore
    jwtSecret: string
    auth: SessionClaims
    paystackSecretKey?: string
    createPaystackTransferRecipient: CreatePaystackTransferRecipient
    chargePaystackMobileMoney?: ChargePaystackMobileMoney
    initializePaystackTransaction?: InitializePaystackTransaction
    verifyPaystackTransaction?: VerifyPaystackTransaction
    createPaystackTransfer?: CreatePaystackTransfer
    webhookDedup?: WebhookDedup
  }
}
