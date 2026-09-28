/**
 * The seller's shop settings — one GET (/vendor/sellers/me) and a small
 * PATCH/POST per section, each returning the fresh seller.
 */
import type { SocialKind } from "@alkemart/domain"
import type { Seller } from "./api"
import { api } from "./http"

export type ShopSettings = Seller & {
  storefront: { tagline: string | null; announcement: { text: string; startsAt: string; endsAt: string } | null; announcementActive: boolean; seoDescription: string | null }
  delivery: { minutes: number | null; days: { min: number; max: number } | null; dispatchHours: number | null }
  /** Delivery fee per zone in pesewas (null = doesn't deliver there) and pickup. */
  fulfillment: { delivery: Record<DeliveryZoneKey, string | null>; pickup: boolean }
  contact: { phone: string | null; hours: { days: string; open: string; close: string } | null; social: Partial<Record<SocialKind, string>> }
  metadata: { delivery_fee_ghs?: number } & Record<string, unknown>
  address: {
    address_1: string | null
    city: string | null
    district: string | null
    province: string | null
    /** GhanaPost GPS digital address. */
    postal_code: string | null
    latitude: number | null
    longitude: number | null
  } | null
  availability: { state: "open" | "paused"; pausedUntil: string | null; note: string | null }
  payment_details: { type: "momo"; provider: MomoProvider; phone: string } | null
}

export type DeliveryZoneKey = "town" | "region" | "country"

export type MomoProvider = "mtn" | "vodafone" | "airteltigo"

type R = { seller: ShopSettings }
const pick = (r: R) => r.seller

export const getShop = () => api<R>("/vendor/sellers/me").then(pick)

export const saveProfile = (patch: { name?: string; logo?: string | null; banner?: string | null }) =>
  api<R>("/vendor/sellers/me", { method: "POST", json: patch }).then(pick)

export const saveStorefront = (patch: { tagline?: string | null; bio?: string | null; seoDescription?: string | null }) =>
  api<R>("/vendor/sellers/me/storefront", { method: "PATCH", json: patch }).then(pick)

export const saveContact = (patch: {
  phone?: string | null
  hours?: { days: string; open: string; close: string } | null
  social?: Partial<Record<SocialKind, string | null>>
}) => api<R>("/vendor/sellers/me/contact", { method: "PATCH", json: patch }).then(pick)

export const saveDelivery = (patch: { days?: { min: number; max: number } | null; dispatchHours?: number | null }) =>
  api<R>("/vendor/sellers/me/delivery", { method: "PATCH", json: patch }).then(pick)

export const saveFulfillment = (input: ShopSettings["fulfillment"]) =>
  api<R>("/vendor/sellers/me/fulfillment", { method: "PATCH", json: input }).then(pick)


export const pauseShop = (input: { until?: string | null; note?: string | null }) =>
  api<R>("/vendor/sellers/me/pause", { method: "POST", json: input }).then(pick)

export const unpauseShop = () => api<R>("/vendor/sellers/me/unpause", { method: "POST" }).then(pick)

export type PolicyBody = { shipping?: string; returnsDays?: number; warranty?: string }
export const getPolicy = () =>
  api<{ current: { version: number; body: PolicyBody; effectiveFrom: string } | null }>("/vendor/sellers/me/policies").then((r) => r.current)
export const savePolicy = (body: PolicyBody) =>
  api<{ policy: { version: number } }>("/vendor/sellers/me/policies", { method: "POST", json: body })

/** Where payouts go. The API registers the number with Paystack first. */
export const savePayoutAccount = (input: { provider: MomoProvider; phone: string }) =>
  api<R>("/vendor/sellers/me/payment-details", { method: "POST", json: input }).then(pick)

export const saveDispatchAddress = (input: {
  pack_region?: string | null
  city?: string | null
  district?: string | null
  address_1?: string | null
  digital_address?: string | null
  latitude?: number | null
  longitude?: number | null
}) => api<R>("/vendor/sellers/me/address", { method: "POST", json: input }).then(pick)

export type AlertTopic = "stock" | "price" | "sla" | "order" | "payout"
export const getAlerts = () => api<{ topics: { topic: AlertTopic; optedIn: boolean }[] }>("/vendor/preferences").then((r) => r.topics)
export const setAlert = (topic: AlertTopic, optedIn: boolean) => api("/vendor/preferences", { method: "PUT", json: { topic, optedIn } })

export const requestResetLink = (email: string) =>
  api<{ ok: true }>("/vendor/auth/password-reset/request", { method: "POST", json: { email } })
/** Consumes the one-time token from the reset email. */
export const confirmResetLink = (token: string, password: string) =>
  api<{ ok: true }>("/vendor/auth/password-reset/confirm", { method: "POST", json: { token, password } })
