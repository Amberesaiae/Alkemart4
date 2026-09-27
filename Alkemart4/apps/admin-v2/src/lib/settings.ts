/** Platform rules — mirrors apps/api/src/routes/admin/settings.ts. Defaults live in packages/domain. */
import { api } from "./http"

export type DeliveryPolicy = {
  sameTownKm: number
  handoverMaxFailures: number
  reportWindowHours: { sameDay: number; multiDay: number }
}

export const getDeliveryPolicy = () => api<{ policy: DeliveryPolicy; defaults: DeliveryPolicy }>("/admin/settings/delivery-policy")

export const saveDeliveryPolicy = (policy: DeliveryPolicy) =>
  api<{ policy: DeliveryPolicy }>("/admin/settings/delivery-policy", { method: "PUT", json: policy })

export type DealPolicy = { validHours: number; sellerReplyHours: number; buyerReplyHours: number; minPercentOfPrice: number; maxOpenPerBuyer: number }
export const getDealPolicy = () => api<{ policy: DealPolicy; defaults: DealPolicy }>("/admin/settings/deal-policy")
export const saveDealPolicy = (policy: DealPolicy) => api<{ policy: DealPolicy }>("/admin/settings/deal-policy", { method: "PUT", json: policy })
