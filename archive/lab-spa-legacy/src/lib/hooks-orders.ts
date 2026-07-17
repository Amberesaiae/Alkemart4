import { useQuery } from "@tanstack/react-query"
import { medusaAmountToPesewas } from "@workspace/platform-config"
import { useMedusa } from "./medusa-provider"

export type AlkemartOrderAddress = {
  fullName: string
  line1: string
  city: string
  region?: string | null
  phone: string
  digitalAddress?: string | null
  countryCode?: string
}

export type AlkemartOrderFulfillment = {
  id: string
  vendorId?: string
  status: string
}

export type AlkemartOrder = {
  id: string
  displayId?: number
  status: string
  fulfillmentStatus?: string
  paymentStatus?: string
  /** cod | momo | unknown — inferred from payment collection when possible */
  paymentMethod: "cod" | "momo" | "unknown"
  createdAt: string
  /** Pesewas — primary total field from Medusa adapter. */
  total: number
  /** Alias for UI that still expects Express naming. */
  totalPesewas: number
  currencyCode: string
  items: {
    id: string
    title: string
    /** Alias of title for Express-era UI (OrderRow, search). */
    titleSnapshot: string
    quantity: number
    /** Alias of quantity. */
    qty: number
    unitPrice: number
    /** unitPrice * qty in pesewas */
    subtotalPesewas: number
    thumbnail?: string
  }[]
  /** Subtotal of line items (pesewas). */
  subtotalPesewas: number
  discountPesewas: number
  promotionCode?: string | null
  shippingTotalPesewas: number
  shippingAddress?: {
    city?: string
    country?: string
  }
  /** Full delivery address for order detail. */
  address?: AlkemartOrderAddress | null
  fulfillments: AlkemartOrderFulfillment[]
}

export const OrderStatus = {
  pending: "pending",
  confirmed: "confirmed",
  fulfilled: "fulfilled",
  cancelled: "cancelled",
  completed: "completed",
} as const

const ORDER_FIELDS =
  "id,display_id,status,fulfillment_status,payment_status,created_at,total,subtotal,shipping_total,discount_total,currency_code," +
  "items.id,items.title,items.quantity,items.unit_price,items.thumbnail," +
  "shipping_address.first_name,shipping_address.last_name,shipping_address.address_1,shipping_address.address_2," +
  "shipping_address.city,shipping_address.province,shipping_address.postal_code,shipping_address.phone,shipping_address.country_code," +
  "payment_collections.payment_sessions.provider_id,payment_collections.payment_sessions.status," +
  "fulfillments.id,fulfillments.packed_at,fulfillments.shipped_at,fulfillments.delivered_at,fulfillments.canceled_at"

function inferPaymentMethod(o: any): "cod" | "momo" | "unknown" {
  const collections = o.payment_collections ?? (o.payment_collection ? [o.payment_collection] : [])
  for (const col of collections) {
    const sessions = col?.payment_sessions ?? []
    for (const s of sessions) {
      const pid = String(s?.provider_id ?? "")
      if (pid.includes("paystack") || pid.includes("momo")) return "momo"
      if (pid.includes("system")) return "cod"
    }
  }
  const meta = o.metadata ?? {}
  if (meta.payment_method === "momo" || meta.ghana_payment === "momo") return "momo"
  if (meta.payment_method === "cod" || meta.ghana_payment === "cod") return "cod"
  // COD path uses system provider; default unknown→cod for completed unpaid accounting
  if (o.payment_status === "captured" || o.payment_status === "not_paid") {
    return o.payment_status === "not_paid" ? "cod" : "unknown"
  }
  return "unknown"
}

function mapFulfillments(o: any): AlkemartOrderFulfillment[] {
  const list = o.fulfillments ?? []
  if (!Array.isArray(list)) return []
  return list.map((f: any, i: number) => {
    let status = "not_delivered"
    if (f.canceled_at) status = "cancelled"
    else if (f.delivered_at) status = "delivered"
    else if (f.shipped_at) status = "shipped"
    else if (f.packed_at) status = "packed"
    return {
      id: f.id ?? `ful_${i}`,
      vendorId: f.provider_id ?? f.location_id ?? undefined,
      status,
    }
  })
}

function mapAddress(o: any): AlkemartOrderAddress | null {
  const a = o.shipping_address
  if (!a) return null
  const first = a.first_name ?? ""
  const last = a.last_name ?? ""
  const fullName = [first, last].filter(Boolean).join(" ") || "Customer"
  return {
    fullName,
    line1: a.address_1 ?? "",
    city: a.city ?? "",
    region: a.province ?? null,
    phone: a.phone ?? "",
    digitalAddress: a.postal_code ?? null,
    countryCode: a.country_code ?? "gh",
  }
}

function medusaOrderToAlkemart(o: any): AlkemartOrder {
  const totalPesewas = medusaAmountToPesewas(Number(o.total ?? 0))
  const subtotalPesewas = medusaAmountToPesewas(
    Number(o.subtotal ?? o.item_subtotal ?? o.total ?? 0),
  )
  const discountPesewas = medusaAmountToPesewas(Number(o.discount_total ?? 0))
  const shippingTotalPesewas = medusaAmountToPesewas(
    Number(o.shipping_total ?? 0),
  )
  const address = mapAddress(o)

  return {
    id: o.id,
    displayId: o.display_id,
    status: o.status ?? "pending",
    fulfillmentStatus: o.fulfillment_status,
    paymentStatus: o.payment_status,
    paymentMethod: inferPaymentMethod(o),
    createdAt: o.created_at,
    total: totalPesewas,
    totalPesewas,
    currencyCode: o.currency_code ?? "ghs",
    items: (o.items ?? []).map((item: any) => {
      const title = item.title ?? item.product_title ?? "Item"
      const quantity = Number(item.quantity ?? 0)
      const unitPrice = medusaAmountToPesewas(Number(item.unit_price ?? 0))
      return {
        id: item.id,
        title,
        titleSnapshot: title,
        quantity,
        qty: quantity,
        unitPrice,
        subtotalPesewas: unitPrice * quantity,
        thumbnail: item.thumbnail,
      }
    }),
    subtotalPesewas,
    discountPesewas,
    promotionCode: o.promotions?.[0]?.code ?? null,
    shippingTotalPesewas,
    shippingAddress: address
      ? { city: address.city, country: address.countryCode }
      : o.shipping_address
        ? {
            city: o.shipping_address.city,
            country: o.shipping_address.country_code,
          }
        : undefined,
    address,
    fulfillments: mapFulfillments(o),
  }
}

export function useListMyOrders() {
  const sdk = useMedusa()

  return useQuery({
    queryKey: ["medusa", "orders"],
    queryFn: async () => {
      try {
        const { orders } = await sdk.store.order.list({
          fields: ORDER_FIELDS,
        } as any)
        return { items: (orders ?? []).map(medusaOrderToAlkemart) }
      } catch {
        return { items: [] }
      }
    },
    retry: false,
    throwOnError: false,
  })
}

export function useGetOrder(orderId: string | undefined) {
  const sdk = useMedusa()

  return useQuery({
    queryKey: ["medusa", "order", orderId],
    queryFn: async () => {
      const { order } = await sdk.store.order.retrieve(orderId!, {
        fields: ORDER_FIELDS,
      } as any)
      return medusaOrderToAlkemart(order)
    },
    enabled: !!orderId,
    retry: false,
    throwOnError: false,
  })
}
