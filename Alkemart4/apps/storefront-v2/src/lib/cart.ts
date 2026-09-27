import { apiJson } from "./http"
import { getWorkersAccessToken } from "./auth"
import { getActiveMarket } from "./market"
import type { SellerRef } from "./seller"

const CART_STORAGE_KEY = "alkemart.storefront.cart_id"

export type CartLine = {
  id: string
  title: string
  quantity: number
  unitPrice: number | null
  currencyCode: string | null
  /** Product behind the offer — absent on APIs predating the field. */
  productId?: string | null
  offerId?: string | null
  seller?: SellerRef | null
  /** Your accepted "make an offer" price is applied to this line (API-decided). */
  dealApplied?: boolean
  /** The listed price when a deal applies. */
  listUnitPrice?: number | null
}

export type StoreCart = {
  id: string
  currencyCode: string | null
  total: number | null
  itemTotal: number | null
  shippingTotal: number | null
  items: CartLine[]
  /** Per-seller delivery fee in major units, keyed by seller id. */
  deliveryBySeller: Record<string, number>
}

export type SellerGroup = {
  key: string
  seller: SellerRef | null
  items: CartLine[]
}

function readStoredCartId(): string | null {
  try {
    return localStorage.getItem(CART_STORAGE_KEY)?.trim() || null
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

/**
 * Group cart lines by seller. Lines without a seller share one "_other"
 * bucket — never invent seller names.
 */
export function groupCartBySeller(items: CartLine[]): SellerGroup[] {
  const map = new Map<string, SellerGroup>()
  for (const line of items) {
    const id = line.seller?.id?.trim()
    const name = line.seller?.name?.trim()
    const key = id || (name ? `name:${name.toLowerCase()}` : "_other")
    let group = map.get(key)
    if (!group) {
      group = { key, seller: line.seller?.name ? line.seller : null, items: [] }
      map.set(key, group)
    }
    group.items.push(line)
  }
  return [...map.values()].sort((a, b) => {
    if (a.key === "_other") return 1
    if (b.key === "_other") return -1
    return (a.seller?.name ?? "").localeCompare(b.seller?.name ?? "")
  })
}

type WorkersCart = {
  cart: { id: string; currency: string }
  items: Array<{
    id: string
    offerId: string
    sellerId: string
    productId?: string | null
    qty: number
    title?: string
    unitPricePesewas?: string
    listPricePesewas?: string
    dealApplied?: boolean
    sellerName?: string
    sellerHandle?: string | null
  }>
  quote: {
    currency: string
    totalPesewas: string
    sellers?: Array<{ sellerId?: string; deliveryFeePesewas: string }>
  }
}

/** Pure mapping of the Workers cart payload (pesewas → major units). */
export function mapWorkersCart(data: WorkersCart): StoreCart {
  // Minor units per major come from the market (100 for cedis; not universal).
  const per = getActiveMarket().currency.minorUnitsPerMajor
  const currency = data.cart.currency || data.quote.currency || "ghs"
  const items: CartLine[] = data.items.map((item) => ({
    id: item.id,
    title: item.title?.trim() || item.offerId,
    quantity: item.qty,
    unitPrice: item.unitPricePesewas != null ? Number(item.unitPricePesewas) / per : null,
    dealApplied: item.dealApplied ?? false,
    listUnitPrice: item.dealApplied && item.listPricePesewas != null ? Number(item.listPricePesewas) / per : null,
    currencyCode: currency,
    productId: item.productId ?? null,
    offerId: item.offerId,
    seller: {
      id: item.sellerId,
      name: item.sellerName?.trim() || item.sellerId,
      handle: item.sellerHandle ?? null,
    },
  }))
  // Items vs delivery are quoted separately — show both, never a lump total.
  const itemTotalPesewas = items.reduce(
    (sum, line) => sum + (line.unitPrice != null ? Math.round(line.unitPrice * per) * line.quantity : 0),
    0,
  )
  const deliveryBySeller: Record<string, number> = {}
  let deliveryPesewas = 0
  for (const s of data.quote.sellers ?? []) {
    const fee = Number(s.deliveryFeePesewas || 0)
    deliveryPesewas += fee
    if (s.sellerId) deliveryBySeller[s.sellerId] = fee / per
  }
  const total = Number(data.quote.totalPesewas) / per
  return {
    id: data.cart.id,
    currencyCode: currency,
    total,
    itemTotal: itemTotalPesewas / per || total - deliveryPesewas / per,
    shippingTotal: deliveryPesewas / per,
    items,
    deliveryBySeller,
  }
}

async function createCart(): Promise<string> {
  const data = await apiJson<{ cartId: string }>("/store/cart", { method: "POST" })
  if (!data.cartId) throw new Error("Workers API did not return a cart id")
  writeStoredCartId(data.cartId)
  return data.cartId
}

/** Ensure a cart id exists (created by the API — never invented). */
export async function ensureCartId(): Promise<string> {
  const existing = readStoredCartId()
  if (existing) {
    try {
      if (await retrieveCart(existing)) return existing
    } catch {
      /* fall through to a fresh cart */
    }
    writeStoredCartId(null)
  }
  return createCart()
}

export async function retrieveCart(cartId?: string): Promise<StoreCart | null> {
  const id = cartId ?? readStoredCartId()
  if (!id) return null
  try {
    return mapWorkersCart(await apiJson<WorkersCart>(`/store/cart/${encodeURIComponent(id)}`, { token: getWorkersAccessToken() }))
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      writeStoredCartId(null)
      return null
    }
    throw err
  }
}

/** Lines bind an offer (ATC binds offerId) — the caller passes a real one. */
export async function addOfferToCart(offerId: string, quantity = 1): Promise<StoreCart> {
  const trimmed = offerId.trim()
  if (!trimmed) throw new Error("This item is not available to buy yet")
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("quantity must be a positive integer")
  }
  const cartId = await ensureCartId()
  await apiJson(`/store/cart/${encodeURIComponent(cartId)}/items`, {
    method: "POST",
    body: JSON.stringify({ offerId: trimmed, qty: quantity }),
  })
  const cart = await retrieveCart(cartId)
  if (!cart) throw new Error("Cart missing after add line item")
  return cart
}

export async function updateLineQuantity(lineId: string, quantity: number): Promise<StoreCart> {
  const cartId = await ensureCartId()
  await apiJson(
    `/store/cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(lineId)}`,
    { method: "PATCH", body: JSON.stringify({ qty: Math.max(0, quantity) }) },
  )
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

/** Re-exported: money formatting is market-driven (see ./market). */
export { formatMoney } from "./market"
