import {
  ZONE_LABEL,
  fulfillmentOptions,
  fulfillmentSettingsFrom,
  type FulfillmentMethod,
  type FulfillmentOption,
  type DeliveryPolicy,
  type FulfillmentSettings,
  type Whereabouts,
} from "@alkemart/domain"
import { displayRegionName } from "@alkemart/shared/ghana"
import type { AuthSeller } from "../auth-repository"
import type { FulfillmentChoice, IntentFulfillment } from "../checkout-repository"

/**
 * A seller's delivery settings and where they dispatch from, read from what
 * the seller saved in Shop (metadata) — the single source for checkout quotes.
 */
export function sellerFulfillment(seller: AuthSeller): { settings: FulfillmentSettings; from: Whereabouts; pickupPlace: string | null } {
  const m = (seller.metadata ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  const from: Whereabouts = {
    city: str(m.city),
    region: seller.packRegion,
    lat: num(m.latitude),
    lng: num(m.longitude),
  }
  const pickupPlace = [str(m.district), str(m.city), seller.packRegion ? displayRegionName(seller.packRegion) : null].filter(Boolean).join(", ") || null
  return { settings: fulfillmentSettingsFrom(m.fulfillment, seller.deliveryFeePesewas ?? 0n), from, pickupPlace }
}

export type SellerOptionsView = {
  sellerId: string
  sellerName: string
  options: { method: FulfillmentMethod; zone: string | null; label: string; feePesewas: string }[]
  pickupPlace: string | null
}

const describe = (o: FulfillmentOption, pickupPlace: string | null) =>
  o.method === "pickup"
    ? { method: o.method, zone: null, label: pickupPlace ? `Pick up in ${pickupPlace}` : "Pick up from the shop", feePesewas: "0" }
    : { method: o.method, zone: o.zone, label: `Delivery · ${ZONE_LABEL[o.zone].toLowerCase()}`, feePesewas: o.feePesewas.toString() }

/** Options per seller for this buyer location. */
export async function optionsForSellers(
  sellerIds: string[],
  findSeller: (id: string) => Promise<AuthSeller | null>,
  to: Whereabouts,
  policy?: Pick<DeliveryPolicy, "sameTownKm">,
): Promise<SellerOptionsView[]> {
  const out: SellerOptionsView[] = []
  for (const id of sellerIds) {
    const seller = await findSeller(id).catch(() => null)
    if (!seller) continue
    const f = sellerFulfillment(seller)
    out.push({
      sellerId: id,
      sellerName: seller.name,
      pickupPlace: f.pickupPlace,
      options: fulfillmentOptions(f.settings, f.from, to, policy).map((o) => describe(o, f.pickupPlace)),
    })
  }
  return out
}

export class FulfillmentUnavailableError extends Error {
  constructor(
    readonly sellerName: string,
    readonly wanted: FulfillmentMethod | null,
  ) {
    super(
      wanted === "pickup"
        ? `${sellerName} doesn't offer pickup. Choose delivery.`
        : wanted === "delivery"
          ? `${sellerName} doesn't deliver to your area. Choose pickup, or remove their items.`
          : `${sellerName} can't deliver to your area and doesn't offer pickup. Remove their items to continue.`,
    )
  }
}

/**
 * Freeze the buyer's choice per seller. Missing choices default to delivery
 * when offered, else pickup. Fees always come from the server-side quote,
 * never from the client.
 */
export async function chooseFulfillment(
  sellerIds: string[],
  findSeller: (id: string) => Promise<AuthSeller | null>,
  to: Whereabouts,
  wanted: Record<string, FulfillmentMethod> | undefined,
  policy?: Pick<DeliveryPolicy, "sameTownKm">,
): Promise<IntentFulfillment> {
  const views = await optionsForSellers(sellerIds, findSeller, to, policy)
  const out: IntentFulfillment = {}
  for (const v of views) {
    const want = wanted?.[v.sellerId] ?? null
    const pick = want ? v.options.find((o) => o.method === want) : (v.options.find((o) => o.method === "delivery") ?? v.options[0])
    if (!pick) throw new FulfillmentUnavailableError(v.sellerName, want)
    const choice: FulfillmentChoice = {
      method: pick.method,
      zone: (pick.zone as FulfillmentChoice["zone"]) ?? null,
      feePesewas: pick.feePesewas,
    }
    out[v.sellerId] = choice
  }
  return out
}

/** The buyer's location as the checkout address describes it. */
export function whereaboutsOf(a: { city?: string; province?: string; latitude?: number; longitude?: number }): Whereabouts {
  return { city: a.city ?? null, region: a.province ?? null, lat: a.latitude ?? null, lng: a.longitude ?? null }
}
