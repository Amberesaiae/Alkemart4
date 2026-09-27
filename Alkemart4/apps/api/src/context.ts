import type { NewsletterStore } from "./newsletter"
import type { PaystackConfig } from "@alkemart/paystack"
import type { AdminAuditLog } from "./admin-audit"
import type { AppealStore } from "./appeals"
import type { CollectionsStore } from "./collections"
import type { ImportBatchStore } from "./import-batches"
import type { CampaignStore } from "./campaigns"
import type { GuideStore } from "./guides"
import type { AccountStore } from "./account-store"
import type { ListingReviewStore } from "./listing-reviews"
import type { SettingsStore } from "./settings-store"
import type { StatementStore } from "./statement-store"
import type { MessagesStore } from "./messages-store"
import type { CompareStore } from "./compare-store"
import type { DealsStore } from "./deals-store"
import type { VideosStore } from "./videos-store"
import type { ShopFeaturedStore } from "./shop-featured"
import type { HomepageContentStore } from "./homepage-content"
import type { ShopPolicyStore } from "./shop-policies"
import type { AuthRepository } from "./auth-repository"
import type { TrafficStore } from "./traffic"
import type { CatalogRepository } from "./catalog-repository"
import type { CheckoutRepository } from "./checkout-repository"
import type { JobProducer } from "./jobs"
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

export type VerifyPaystackTransfer = (
  cfg: PaystackConfig,
  reference: string,
) => Promise<{ status: string; amount: number | null; transferCode: string | null; reason: string | null }>

export type RefundPaystackTransaction = (
  cfg: PaystackConfig,
  input: { reference: string; amountMinor?: bigint },
) => Promise<{ status: string; refundId: string | null }>

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
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

export type AppEnv = {
  Bindings: ApiEnv
  Variables: {
    repo: CatalogRepository
    authRepo: AuthRepository
    checkoutRepo: CheckoutRepository
    jobs: JobProducer
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
    accounts: AccountStore
    newsletter: NewsletterStore
    reviews: ListingReviewStore
    /** Admin-tunable platform rules (platform_settings). */
    settings: SettingsStore
    /** Frozen monthly statements (0043). */
    statements: StatementStore
    /** Buyer ↔ seller messages and product Q&A (0045). */
    messages: MessagesStore
    compare: CompareStore
    /** Make an offer: negotiation settings and price offers (0046). */
    deals: DealsStore
    /** Product video links and photo-reading allowance (0047). */
    videos: VideosStore
    jwtSecret: string
    auth: SessionClaims
    paystackSecretKey?: string
    createPaystackTransferRecipient: CreatePaystackTransferRecipient
    chargePaystackMobileMoney?: ChargePaystackMobileMoney
    initializePaystackTransaction?: InitializePaystackTransaction
    verifyPaystackTransaction?: VerifyPaystackTransaction
    createPaystackTransfer?: CreatePaystackTransfer
    verifyPaystackTransfer?: VerifyPaystackTransfer
    refundPaystackTransaction?: RefundPaystackTransaction
    webhookDedup?: WebhookDedup
  }
}
