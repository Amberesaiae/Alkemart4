import { getMedusaClient } from "./medusa"
import type { SellerRef } from "@/components/seller-chip"
import { groupCartBySeller, type CartLine } from "./cart"

export type OrderItem = {
  id: string
  title: string
  quantity: number
  unitPrice: number | null
  productId?: string | null
  thumbnail?: string | null
  seller?: SellerRef | null
}

export type OrderAddress = {
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  address1?: string | null
  city?: string | null
  province?: string | null
  countryCode?: string | null
  postalCode?: string | null
}

export type StoreOrder = {
  id: string
  displayId?: number | null
  status: string
  paymentStatus?: string | null
  fulfillmentStatus?: string | null
  createdAt?: string
  total: number | null
  itemTotal?: number | null
  shippingTotal?: number | null
  currencyCode: string | null
  items: OrderItem[]
  shippingAddress?: OrderAddress | null
  email?: string | null
}

const ORDER_LIST_FIELDS =
  "id,display_id,status,created_at,total,currency_code," +
  "items.id,items.title,items.quantity,items.unit_price," +
  "shipping_address.city,shipping_address.first_name,shipping_address.last_name"

const ORDER_DETAIL_FIELDS =
  "id,display_id,status,payment_status,fulfillment_status,created_at,total,item_total,shipping_total,currency_code,email," +
  "items.id,items.title,items.quantity,items.unit_price,items.thumbnail,items.product_id," +
  "+items.product,+items.product.seller,+items.product.thumbnail," +
  "shipping_address.*"

function mapAddress(
  addr: Record<string, unknown> | undefined | null,
): OrderAddress | null {
  if (!addr || typeof addr !== "object") return null
  return {
    firstName: typeof addr.first_name === "string" ? addr.first_name : null,
    lastName: typeof addr.last_name === "string" ? addr.last_name : null,
    phone: typeof addr.phone === "string" ? addr.phone : null,
    address1: typeof addr.address_1 === "string" ? addr.address_1 : null,
    city: typeof addr.city === "string" ? addr.city : null,
    province: typeof addr.province === "string" ? addr.province : null,
    countryCode:
      typeof addr.country_code === "string" ? addr.country_code : null,
    postalCode:
      typeof addr.postal_code === "string" ? addr.postal_code : null,
  }
}

function extractItemSeller(line: Record<string, unknown>): SellerRef | null {
  const product = line.product as Record<string, unknown> | undefined
  const seller = product?.seller as
    | { id?: string; name?: string; handle?: string }
    | undefined
  if (seller?.name?.trim()) {
    return {
      id: seller.id ?? null,
      name: seller.name.trim(),
      handle: seller.handle ?? null,
    }
  }
  return null
}

function mapOrder(raw: Record<string, unknown>): StoreOrder {
  const items = (raw.items as Record<string, unknown>[] | undefined) ?? []
  const addr = raw.shipping_address as Record<string, unknown> | undefined
  return {
    id: String(raw.id),
    displayId:
      raw.display_id != null ? Number(raw.display_id) : null,
    status: String(raw.status ?? "unknown"),
    paymentStatus:
      typeof raw.payment_status === "string" ? raw.payment_status : null,
    fulfillmentStatus:
      typeof raw.fulfillment_status === "string"
        ? raw.fulfillment_status
        : null,
    createdAt:
      typeof raw.created_at === "string" ? raw.created_at : undefined,
    total: raw.total != null ? Number(raw.total) : null,
    itemTotal: raw.item_total != null ? Number(raw.item_total) : null,
    shippingTotal:
      raw.shipping_total != null ? Number(raw.shipping_total) : null,
    currencyCode:
      typeof raw.currency_code === "string" ? raw.currency_code : null,
    email: typeof raw.email === "string" ? raw.email : null,
    items: items.map((i) => {
      const product = i.product as Record<string, unknown> | undefined
      return {
        id: String(i.id),
        title: String(i.title ?? "Item"),
        quantity: Number(i.quantity ?? 0),
        unitPrice: i.unit_price != null ? Number(i.unit_price) : null,
        productId:
          typeof i.product_id === "string"
            ? i.product_id
            : typeof product?.id === "string"
              ? product.id
              : null,
        thumbnail:
          typeof i.thumbnail === "string"
            ? i.thumbnail
            : typeof product?.thumbnail === "string"
              ? product.thumbnail
              : null,
        seller: extractItemSeller(i),
      }
    }),
    shippingAddress: mapAddress(addr),
  }
}

/** Prefer display_id; otherwise short lab-style ref from API id (not a formal receipt). */
export function formatOrderLabel(order: StoreOrder): string {
  if (order.displayId != null && Number.isFinite(order.displayId)) {
    return `#${order.displayId}`
  }
  const tail = order.id.replace(/^order_/, "").slice(-6).toUpperCase()
  return `Ref · ${tail}`
}

export function formatAddressLines(addr: OrderAddress): string[] {
  const lines: string[] = []
  const name = [addr.firstName, addr.lastName].filter(Boolean).join(" ")
  if (name) lines.push(name)
  if (addr.address1) lines.push(addr.address1)
  const cityLine = [addr.city, addr.province, addr.postalCode]
    .filter(Boolean)
    .join(", ")
  if (cityLine) lines.push(cityLine)
  if (addr.countryCode) lines.push(addr.countryCode.toUpperCase())
  if (addr.phone) lines.push(addr.phone)
  return lines
}

/** Reuse cart grouping for order items (same seller key rules). */
export function groupOrderItemsBySeller(items: OrderItem[]) {
  const asLines: CartLine[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    currencyCode: null,
    thumbnail: i.thumbnail,
    productId: i.productId,
    seller: i.seller,
  }))
  return groupCartBySeller(asLines).map((g) => ({
    ...g,
    items: g.items.map((line) => {
      const src = items.find((i) => i.id === line.id)!
      return src
    }),
  }))
}

export async function listMyOrders(): Promise<StoreOrder[]> {
  const sdk = getMedusaClient()
  const token = await sdk.client.getToken()
  if (!token) {
    throw new Error("Sign in required to list orders")
  }
  const { orders } = await sdk.store.order.list({
    fields: ORDER_LIST_FIELDS,
  } as never)
  const list = (orders ?? []) as unknown as Record<string, unknown>[]
  return list.map((o) => mapOrder(o))
}

export async function getOrder(orderId: string): Promise<StoreOrder> {
  const id = orderId.trim()
  if (!id) throw new Error("order id required")
  const sdk = getMedusaClient()
  const { order } = await sdk.store.order.retrieve(id, {
    fields: ORDER_DETAIL_FIELDS,
  } as never)
  return mapOrder(order as unknown as Record<string, unknown>)
}
