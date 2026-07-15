import { useQuery } from "@tanstack/react-query"
import { medusaAmountToPesewas } from "@workspace/platform-config"
import { useMedusa } from "./medusa-provider"

export type AlkemartOrder = {
  id: string
  displayId?: number
  status: string
  fulfillmentStatus?: string
  paymentStatus?: string
  createdAt: string
  total: number
  currencyCode: string
  items: {
    id: string
    title: string
    quantity: number
    unitPrice: number
    thumbnail?: string
  }[]
  shippingAddress?: {
    city?: string
    country?: string
  }
}

export const OrderStatus = {
  pending: "pending",
  confirmed: "confirmed",
  fulfilled: "fulfilled",
  cancelled: "cancelled",
  completed: "completed",
} as const

function medusaOrderToAlkemart(o: any): AlkemartOrder {
  return {
    id: o.id,
    displayId: o.display_id,
    status: o.status ?? "pending",
    fulfillmentStatus: o.fulfillment_status,
    paymentStatus: o.payment_status,
    createdAt: o.created_at,
    total: medusaAmountToPesewas(Number(o.total ?? 0)),
    currencyCode: o.currency_code ?? "ghs",
    items: (o.items ?? []).map((item: any) => ({
      id: item.id,
      title: item.title ?? item.product_title ?? "Item",
      quantity: item.quantity,
      unitPrice: medusaAmountToPesewas(Number(item.unit_price ?? 0)),
      thumbnail: item.thumbnail,
    })),
    shippingAddress: o.shipping_address
      ? {
          city: o.shipping_address.city,
          country: o.shipping_address.country_code,
        }
      : undefined,
  }
}

export function useListMyOrders() {
  const sdk = useMedusa()

  return useQuery({
    queryKey: ["medusa", "orders"],
    queryFn: async () => {
      try {
        const { orders } = await sdk.store.order.list({
          fields: "id,display_id,status,fulfillment_status,payment_status,created_at,total,currency_code,items.id,items.title,items.quantity,items.unit_price,items.thumbnail,shipping_address.city,shipping_address.country_code",
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
        fields: "id,display_id,status,fulfillment_status,payment_status,created_at,total,currency_code,items.id,items.title,items.quantity,items.unit_price,items.thumbnail,shipping_address.city,shipping_address.country_code",
      } as any)
      return medusaOrderToAlkemart(order)
    },
    enabled: !!orderId,
    retry: false,
    throwOnError: false,
  })
}
