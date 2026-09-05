import { getMedusaClient } from "./medusa"
import type { SellerRef } from "@/components/seller-chip"
import { groupCartBySeller, type CartLine } from "./cart"
import { getAlkemartApiUrl } from "./env"
import { getWorkersAccessToken } from "./auth"

function useWorkersOrders(): boolean {
  return Boolean(getAlkemartApiUrl())
}

function pesewasToMajor(pesewas: string | number | null | undefined): number | null {
  if (pesewas == null) return null
  const n = typeof pesewas === "string" ? Number(pesewas) : pesewas
  if (!Number.isFinite(n)) return null
  return n / 100
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

function mapWorkersOrderGroup(group: WorkersOrderGroup): StoreOrder {
  const items: OrderItem[] = []
  for (const order of group.orders ?? []) {
    for (const item of order.items ?? []) {
      items.push({
        id: item.id,
        title: item.title,
        quantity: item.qty,
        unitPrice: pesewasToMajor(item.unitPricePesewas),
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
    paymentStatus: group.paymentStatus ?? "captured",
    fulfillmentStatus: group.fulfillmentStatus ?? "placed",
    createdAt: group.createdAt ?? undefined,
    total: pesewasToMajor(group.totalPesewas),
    itemTotal: pesewasToMajor(
      (group.orders ?? []).reduce((sum, o) => sum + (Number(o.subtotalPesewas) || 0), 0),
    ),
    shippingTotal: pesewasToMajor(shippingTotal),
    currencyCode: group.currency || "ghs",
    email: group.buyerEmail ?? null,
    items,
    shippingAddress: mapAddress(group.shippingAddress ?? null),
  }
}

async function workersListMyOrders(): Promise<StoreOrder[]> {
  const token = getWorkersAccessToken()
  if (!token) throw new Error("Sign in required to list orders")
  const res = await fetch(`${getAlkemartApiUrl()}/store/orders`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  })
  const data = (await res.json().catch(() => ({}))) as {
    items?: WorkersOrderGroup[]
    error?: string
    message?: string
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Orders failed (${res.status})`)
  }
  return (data.items ?? []).map(mapWorkersOrderGroup)
}

async function workersGetOrder(
  orderId: string,
  opts?: { email?: string | null },
): Promise<StoreOrder> {
  const token = getWorkersAccessToken()
  if (token) {
    const res = await fetch(
      `${getAlkemartApiUrl()}/store/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    )
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
  return workersLookupOrderByEmail(orderId, email)
}

async function workersLookupOrderByEmail(
  orderId: string,
  email: string,
): Promise<StoreOrder> {
  const res = await fetch(`${getAlkemartApiUrl()}/store/orders/lookup`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId: orderId.trim(),
      email: email.trim(),
    }),
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
        (res.status === 404
          ? "Order not found for that id and email"
          : `Lookup failed (${res.status})`),
    )
  }
  return mapWorkersOrderGroup(data.orderGroup)
}

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
  "items.id,items.title,items.detail.quantity,items.unit_price," +
  "shipping_address.city,shipping_address.first_name,shipping_address.last_name"

const ORDER_DETAIL_FIELDS =
  "id,display_id,status,payment_status,fulfillment_status,created_at,total,item_total,shipping_total,currency_code,email," +
  "items.id,items.title,items.detail.quantity,items.unit_price,items.thumbnail,items.product_id," +
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
      const detail = i.detail as Record<string, unknown> | undefined
      return {
        id: String(i.id),
        title: String(i.title ?? "Item"),
        quantity: Number(
          detail?.quantity ?? i.quantity ?? 0,
        ),
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
/**
 * Buyer-facing order label — never dump raw system ids in chrome.
 * Prefer display_id (#1234); otherwise short ref from id tail.
 */
export function formatOrderLabel(order: Pick<StoreOrder, "id" | "displayId">): string {
  if (order.displayId != null && Number.isFinite(order.displayId)) {
    return `Order #${order.displayId}`
  }
  return `Order ${maskOrderId(order.id)}`
}

/** Short professional ref for lists / recent — no full order_… strings. */
export function maskOrderId(orderId: string): string {
  const raw = orderId.trim()
  if (!raw) return "····"
  const tail = raw.replace(/^order_/i, "").slice(-6).toUpperCase()
  return `···${tail}`
}

/** Mask email for display (privacy) — a***@domain.com */
export function maskEmail(email: string): string {
  const e = email.trim()
  const at = e.indexOf("@")
  if (at < 1) return "···"
  const local = e.slice(0, at)
  const domain = e.slice(at + 1)
  const head = local.charAt(0)
  return `${head}***@${domain}`
}

/** Support reference copy — full id only when user explicitly copies. */
export function orderSupportReference(order: Pick<StoreOrder, "id" | "displayId">): string {
  if (order.displayId != null && Number.isFinite(order.displayId)) {
    return `Order #${order.displayId}`
  }
  return order.id
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
  if (useWorkersOrders()) return workersListMyOrders()

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

/**
 * Retrieve order:
 * Workers: Bearer GET /store/orders/:id, else POST /store/orders/lookup
 * Medusa: JWT retrieve, else POST /store/alkemart/orders/lookup
 */
export async function getOrder(
  orderId: string,
  opts?: { email?: string | null },
): Promise<StoreOrder> {
  const id = orderId.trim()
  if (!id) throw new Error("order id required")
  if (useWorkersOrders()) return workersGetOrder(id, opts)

  const sdk = getMedusaClient()
  const token = await sdk.client.getToken()

  if (token) {
    try {
      const { order } = await sdk.store.order.retrieve(id, {
        fields: ORDER_DETAIL_FIELDS,
      } as never)
      return mapOrder(order as unknown as Record<string, unknown>)
    } catch {
      /* fall through to email lookup when provided */
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

  return lookupOrderByEmail(id, email)
}

/** Guest-safe lookup — server requires email match (no PII without proof). */
export async function lookupOrderByEmail(
  orderId: string,
  email: string,
): Promise<StoreOrder> {
  if (useWorkersOrders()) return workersLookupOrderByEmail(orderId, email)

  const { getBackendUrl, getPublishableKey } = await import("./env")
  const base = getBackendUrl()
  const pk = getPublishableKey()
  const res = await fetch(`${base}/store/alkemart/orders/lookup`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-publishable-api-key": pk,
    },
    body: JSON.stringify({
      order_id: orderId.trim(),
      email: email.trim(),
    }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(
      data.error ||
        (res.status === 404
          ? "Order not found for that id and email"
          : `Lookup failed (${res.status})`),
    )
  }
  const data = (await res.json()) as { order?: Record<string, unknown> }
  if (!data.order) throw new Error("Order not found for that id and email")
  return mapOrder(data.order)
}
