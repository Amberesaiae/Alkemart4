import { pesewasToMajor } from "@alkemart/shared/ghana"
import { getAlkemartApiUrl } from "./env"
import { getWorkersAccessToken } from "./auth"
import { getMarketCurrency } from "@/design/market"

export type OrderItemSeller = { id: string | null; name: string; handle: string | null }

export type OrderItem = {
  id: string
  title: string
  quantity: number
  unitPrice: number | null
  productId?: string | null
  thumbnail?: string | null
  seller?: OrderItemSeller | null
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

type WorkersOrderItem = {
  id: string
  title: string
  qty: number
  unitPricePesewas: string
  productId?: string
  sellerId?: string
}

type WorkersOrder = {
  id: string
  sellerId: string
  status: string
  subtotalPesewas: string
  deliveryFeePesewas: string
  items: WorkersOrderItem[]
}

type WorkersOrderGroup = {
  id: string
  buyerEmail?: string
  totalPesewas: string
  currency: string
  createdAt?: string | null
  paymentStatus?: string | null
  fulfillmentStatus?: string | null
  shippingAddress?: Record<string, unknown> | null
  orders: WorkersOrder[]
}

function major(pesewas: string | number | null | undefined): number | null {
  if (pesewas == null) return null
  const n = typeof pesewas === "string" ? Number(pesewas) : pesewas
  if (!Number.isFinite(n)) return null
  return pesewasToMajor(n)
}

function mapAddress(addr: Record<string, unknown> | undefined | null): OrderAddress | null {
  if (!addr || typeof addr !== "object") return null
  const s = (k: string): string | null => (typeof addr[k] === "string" ? (addr[k] as string) : null)
  return {
    firstName: s("first_name"),
    lastName: s("last_name"),
    phone: s("phone"),
    address1: s("address_1"),
    city: s("city"),
    province: s("province"),
    countryCode: s("country_code"),
    postalCode: s("postal_code"),
  }
}

function mapWorkersOrderGroup(group: WorkersOrderGroup): StoreOrder {
  const items: OrderItem[] = []
  for (const order of group.orders ?? []) {
    for (const item of order.items ?? []) {
      items.push({
        id: item.id,
        title: item.title,
        quantity: item.qty,
        unitPrice: major(item.unitPricePesewas),
        productId: item.productId ?? null,
        thumbnail: null,
        seller: item.sellerId
          ? { id: item.sellerId, name: item.sellerId, handle: null }
          : order.sellerId
            ? { id: order.sellerId, name: order.sellerId, handle: null }
            : null,
      })
    }
  }
  const shippingTotal = (group.orders ?? []).reduce(
    (sum, o) => sum + (Number(o.deliveryFeePesewas) || 0),
    0,
  )
  return {
    id: group.id,
    displayId: null,
    status: group.fulfillmentStatus ?? "placed",
    paymentStatus: group.paymentStatus ?? null,
    fulfillmentStatus: group.fulfillmentStatus ?? "placed",
    createdAt: group.createdAt ?? undefined,
    total: major(group.totalPesewas),
    itemTotal: major((group.orders ?? []).reduce((sum, o) => sum + (Number(o.subtotalPesewas) || 0), 0)),
    shippingTotal: major(shippingTotal),
    currencyCode: group.currency || getMarketCurrency(),
    email: group.buyerEmail ?? null,
    items,
    shippingAddress: mapAddress(group.shippingAddress ?? null),
  }
}

export async function listMyOrders(): Promise<StoreOrder[]> {
  const base = getAlkemartApiUrl()
  if (!base) throw new Error("VITE_ALKEMART_API_URL is not set")
  const token = getWorkersAccessToken()
  if (!token) throw new Error("Sign in required to list orders")
  const res = await fetch(`${base}/store/orders`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  })
  const data = (await res.json().catch(() => ({}))) as {
    items?: WorkersOrderGroup[]
    error?: string
    message?: string
  }
  if (!res.ok) throw new Error(data.error || data.message || `Orders failed (${res.status})`)
  return (data.items ?? []).map(mapWorkersOrderGroup)
}

export async function getOrder(
  orderId: string,
  opts?: { email?: string | null },
): Promise<StoreOrder> {
  const base = getAlkemartApiUrl()
  if (!base) throw new Error("VITE_ALKEMART_API_URL is not set")
  const token = getWorkersAccessToken()
  if (token) {
    const res = await fetch(`${base}/store/orders/${encodeURIComponent(orderId)}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = (await res.json()) as { orderGroup?: WorkersOrderGroup }
      if (data.orderGroup) return mapWorkersOrderGroup(data.orderGroup)
    }
  }
  const email = opts?.email?.trim()
  if (!email) {
    throw new Error(
      token
        ? "Order not found for this account. Try looking up with the checkout email."
        : "Enter the email used at checkout to view this order.",
    )
  }
  const res = await fetch(`${base}/store/orders/lookup`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: orderId.trim(), email }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    orderGroup?: WorkersOrderGroup
    error?: string
    message?: string
  }
  if (!res.ok || !data.orderGroup) {
    throw new Error(
      data.error ||
        data.message ||
        (res.status === 404 ? "Order not found for that id and email" : `Lookup failed (${res.status})`),
    )
  }
  return mapWorkersOrderGroup(data.orderGroup)
}

/** Buyer-facing label — never dump raw system ids in chrome. */
export function formatOrderLabel(order: Pick<StoreOrder, "id" | "displayId">): string {
  if (order.displayId != null && Number.isFinite(order.displayId)) return `Order #${order.displayId}`
  return `Order ${maskOrderId(order.id)}`
}

export function maskOrderId(id: string): string {
  const clean = id.trim()
  if (clean.length <= 8) return clean
  return `…${clean.slice(-6)}`
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@")
  if (!domain) return email
  const head = user.slice(0, 2)
  return `${head}•••@${domain}`
}

export function orderSupportReference(order: Pick<StoreOrder, "id">): string {
  return order.id
}

export function formatAddressLines(addr: OrderAddress): string[] {
  const name = [addr.firstName, addr.lastName].filter(Boolean).join(" ").trim()
  const lines = [
    name || null,
    addr.address1 || null,
    [addr.city, addr.province].filter(Boolean).join(", ") || null,
    addr.phone || null,
  ].filter((x): x is string => Boolean(x))
  return lines
}

export function groupOrderItemsBySeller(items: OrderItem[]): {
  key: string
  seller: OrderItemSeller | null
  items: OrderItem[]
}[] {
  const map = new Map<string, { seller: OrderItemSeller | null; items: OrderItem[] }>()
  for (const item of items) {
    const key = item.seller?.id ?? item.seller?.name ?? "items"
    const entry = map.get(key) ?? { seller: item.seller ?? null, items: [] }
    entry.items.push(item)
    map.set(key, entry)
  }
  return [...map.entries()].map(([key, v]) => ({ key, seller: v.seller, items: v.items }))
}
