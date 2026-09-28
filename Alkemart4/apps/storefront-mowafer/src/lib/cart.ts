import { addCartItem, createCart, ensureApiBaseUrl, workersJson } from "./api"
import { getAlkemartApiUrl } from "./env"
import { getMarketCurrency, getMarketLocale } from "@/design/market"
import { normalizeCurrencyCode } from "./money"

const CART_STORAGE_KEY = "alkemart.storefront.cart_id"

export type SellerRef = {
  id?: string | null
  name: string
  handle?: string | null
}

export type CartLine = {
  id: string
  title: string
  quantity: number
  unitPrice: number | null
  currencyCode: string | null
  thumbnail?: string | null
  productId?: string | null
  offerId?: string | null
  seller?: SellerRef | null
  categoryHandle?: string | null
  categoryName?: string | null
}

export type StoreCart = {
  id: string
  currencyCode: string | null
  total: number | null
  itemTotal: number | null
  shippingTotal: number | null
  items: CartLine[]
}

function readStoredCartId(): string | null {
  try {
    const id = localStorage.getItem(CART_STORAGE_KEY)?.trim()
    return id || null
  } catch {
    return null
  }
}

function writeStoredCartId(id: string | null): void {
  try {
    if (!id) localStorage.removeItem(CART_STORAGE_KEY)
    else localStorage.setItem(CART_STORAGE_KEY, id)
  } catch {
    /* private mode */
  }
}

type WorkersCartPayload = {
  cart: { id: string; currency: string }
  items: Array<{
    id: string
    offerId: string
    sellerId: string
    qty: number
    title?: string
    unitPricePesewas?: string
    sellerName?: string
    sellerHandle?: string | null
    thumbnail?: string | null
    categoryHandle?: string | null
    categoryName?: string | null
  }>
  quote: {
    currency: string
    totalPesewas: string
    sellers?: Array<{ deliveryFeePesewas: string }>
  }
}

function mapWorkersCart(data: WorkersCartPayload): StoreCart {
  const items = data.items.map((item) => ({
    id: item.id,
    title: item.title?.trim() || item.offerId,
    quantity: item.qty,
    unitPrice: item.unitPricePesewas != null ? Number(item.unitPricePesewas) / 100 : null,
    currencyCode: data.cart.currency || getMarketCurrency(),
    offerId: item.offerId,
    thumbnail: item.thumbnail ?? null,
    seller: {
      id: item.sellerId,
      name: item.sellerName?.trim() || item.sellerId,
      handle: item.sellerHandle ?? null,
    },
    categoryHandle: item.categoryHandle ?? null,
    categoryName: item.categoryName ?? null,
  }))
  const itemTotalPesewas = items.reduce(
    (sum, line) => sum + (line.unitPrice != null ? line.unitPrice * line.quantity * 100 : 0),
    0,
  )
  const deliveryPesewas = (data.quote.sellers ?? []).reduce(
    (sum, s) => sum + Number(s.deliveryFeePesewas || 0),
    0,
  )
  const total = Number(data.quote.totalPesewas) / 100
  return {
    id: data.cart.id,
    currencyCode: data.cart.currency || data.quote.currency || getMarketCurrency(),
    total,
    itemTotal: itemTotalPesewas / 100 || total - deliveryPesewas / 100,
    shippingTotal: deliveryPesewas / 100,
    items,
  }
}

async function createCartId(): Promise<string> {
  ensureApiBaseUrl()
  const data = await createCart()
  if (!data.cartId) throw new Error("Workers API did not return a cart id")
  writeStoredCartId(data.cartId)
  return data.cartId
}

export async function ensureCartId(): Promise<string> {
  if (!getAlkemartApiUrl()) throw new Error("VITE_ALKEMART_API_URL is not set")
  const existing = readStoredCartId()
  if (existing) {
    try {
      await retrieveCart(existing)
      return existing
    } catch {
      writeStoredCartId(null)
    }
  }
  return createCartId()
}

export async function retrieveCart(cartId?: string): Promise<StoreCart | null> {
  const id = cartId ?? readStoredCartId()
  if (!id) return null
  if (!getAlkemartApiUrl()) return null
  try {
    const data = await workersJson<WorkersCartPayload>(`/store/cart/${encodeURIComponent(id)}`)
    return mapWorkersCart(data)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 404) {
      writeStoredCartId(null)
      return null
    }
    throw err
  }
}

export async function addOfferToCart(offerId: string, quantity = 1): Promise<StoreCart> {
  const trimmed = offerId.trim()
  if (!trimmed) throw new Error("This item is not available to buy yet")
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("quantity must be a positive integer")
  }
  const cartId = await ensureCartId()
  ensureApiBaseUrl()
  await addCartItem(cartId, { offerId: trimmed, qty: quantity })
  const cart = await retrieveCart(cartId)
  if (!cart) throw new Error("Cart missing after add line item")
  return cart
}

export async function updateLineQuantity(lineId: string, quantity: number): Promise<StoreCart> {
  const cartId = await ensureCartId()
  await workersJson(`/store/cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(lineId)}`, {
    method: "PATCH",
    body: JSON.stringify({ qty: Math.max(0, quantity) }),
  })
  const cart = await retrieveCart(cartId)
  if (!cart) throw new Error("Cart missing after update")
  return cart
}

export async function removeLine(lineId: string): Promise<StoreCart> {
  return updateLineQuantity(lineId, 0)
}

export function clearLocalCartId(): void {
  writeStoredCartId(null)
}

export function getLocalCartId(): string | null {
  return readStoredCartId()
}

export function formatMoney(
  amount: number | null | undefined,
  currencyCode: string | null | undefined,
): string {
  if (amount == null || !Number.isFinite(amount)) return "—"
  const code = normalizeCurrencyCode(currencyCode)
  try {
    return new Intl.NumberFormat(getMarketLocale(), {
      style: "currency",
      currency: code,
    }).format(amount)
  } catch {
    return `${code} ${amount}`
  }
}
