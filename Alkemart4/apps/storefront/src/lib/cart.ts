import { commerceContext, getMedusaClient } from "./medusa"
import type { SellerRef } from "@/components/seller-chip"

const CART_STORAGE_KEY = "alkemart.storefront.cart_id"

/** Fields so cart lines can surface product + seller when Mercur hydrates them. */
const CART_FIELDS =
  "+items.product,+items.product.seller,+items.product.handle,+items.product.thumbnail,+items.thumbnail,+items.variant"

export type CartLine = {
  id: string
  title: string
  quantity: number
  unitPrice: number | null
  currencyCode: string | null
  thumbnail?: string | null
  productId?: string | null
  seller?: SellerRef | null
}

export type StoreCart = {
  id: string
  currencyCode: string | null
  total: number | null
  itemTotal: number | null
  shippingTotal: number | null
  items: CartLine[]
}

export type SellerGroup = {
  key: string
  seller: SellerRef | null
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

function extractLineSeller(line: Record<string, unknown>): SellerRef | null {
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
  const meta = product?.metadata as Record<string, unknown> | undefined
  if (meta && typeof meta.seller_name === "string" && meta.seller_name.trim()) {
    return {
      name: meta.seller_name.trim(),
      handle:
        typeof meta.seller_handle === "string" ? meta.seller_handle : null,
      id: typeof meta.seller_id === "string" ? meta.seller_id : null,
    }
  }
  return null
}

function mapCart(raw: Record<string, unknown>): StoreCart {
  const itemsRaw = (raw.items as Record<string, unknown>[] | undefined) ?? []
  const currency =
    typeof raw.currency_code === "string" ? raw.currency_code : null

  return {
    id: String(raw.id),
    currencyCode: currency,
    total: raw.total != null ? Number(raw.total) : null,
    itemTotal: raw.item_total != null ? Number(raw.item_total) : null,
    shippingTotal:
      raw.shipping_total != null ? Number(raw.shipping_total) : null,
    items: itemsRaw.map((line) => {
      const product = line.product as Record<string, unknown> | undefined
      const thumb =
        typeof line.thumbnail === "string"
          ? line.thumbnail
          : typeof product?.thumbnail === "string"
            ? product.thumbnail
            : null
      return {
        id: String(line.id),
        title: String(line.title ?? line.product_title ?? "Item"),
        quantity: Number(line.quantity ?? 0),
        unitPrice:
          line.unit_price != null ? Number(line.unit_price) : null,
        currencyCode: currency,
        thumbnail: thumb,
        productId:
          typeof line.product_id === "string"
            ? line.product_id
            : typeof product?.id === "string"
              ? product.id
              : null,
        seller: extractLineSeller(line),
      }
    }),
  }
}

/**
 * Group cart lines by seller when API provides seller identity.
 * Lines without seller share one "Other items" bucket — never invent seller names.
 */
export function groupCartBySeller(items: CartLine[]): SellerGroup[] {
  const map = new Map<string, SellerGroup>()
  for (const line of items) {
    const id = line.seller?.id?.trim()
    const name = line.seller?.name?.trim()
    const key = id || (name ? `name:${name.toLowerCase()}` : "_other")
    let group = map.get(key)
    if (!group) {
      group = {
        key,
        seller: line.seller?.name ? line.seller : null,
        items: [],
      }
      map.set(key, group)
    }
    group.items.push(line)
  }
  // Named sellers first, "other" last
  return [...map.values()].sort((a, b) => {
    if (a.key === "_other") return 1
    if (b.key === "_other") return -1
    const an = a.seller?.name ?? ""
    const bn = b.seller?.name ?? ""
    return an.localeCompare(bn)
  })
}

async function createCart(): Promise<string> {
  const sdk = getMedusaClient()
  const { regionId, salesChannelId } = commerceContext()
  const { cart } = await sdk.store.cart.create({
    region_id: regionId,
    sales_channel_id: salesChannelId,
  })
  if (!cart?.id) {
    throw new Error("Store API did not return a cart id")
  }
  writeStoredCartId(cart.id)
  return cart.id
}

/** Ensure a cart id exists (create via API — no invented ids). */
export async function ensureCartId(): Promise<string> {
  const existing = readStoredCartId()
  if (existing) {
    try {
      await retrieveCart(existing)
      return existing
    } catch {
      writeStoredCartId(null)
    }
  }
  return createCart()
}

export async function retrieveCart(cartId?: string): Promise<StoreCart | null> {
  const id = cartId ?? readStoredCartId()
  if (!id) return null
  const sdk = getMedusaClient()
  try {
    const { cart } = await sdk.store.cart.retrieve(id, {
      fields: CART_FIELDS,
    } as never)
    return mapCart(cart as unknown as Record<string, unknown>)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 404) {
      writeStoredCartId(null)
      return null
    }
    throw err
  }
}

/**
 * Mercur requires offer_id on line items (not bare variant_id).
 * Caller must pass offerId from product list/retrieve — never invent.
 */
export async function addOfferToCart(
  offerId: string,
  quantity = 1,
): Promise<StoreCart> {
  const trimmed = offerId.trim()
  if (!trimmed) {
    throw new Error("This item is not available to buy yet")
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("quantity must be a positive integer")
  }

  const cartId = await ensureCartId()
  const sdk = getMedusaClient()
  await sdk.store.cart.createLineItem(cartId, {
    offer_id: trimmed,
    quantity,
  } as never)

  const cart = await retrieveCart(cartId)
  if (!cart) throw new Error("Cart missing after add line item")
  return cart
}

export async function updateLineQuantity(
  lineId: string,
  quantity: number,
): Promise<StoreCart> {
  const cartId = await ensureCartId()
  const sdk = getMedusaClient()
  if (quantity < 1) {
    await sdk.store.cart.deleteLineItem(cartId, lineId)
  } else {
    await sdk.store.cart.updateLineItem(cartId, lineId, { quantity })
  }
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

/**
 * Attach the local guest cart to the signed-in customer.
 * POST /store/carts/:id/customer (Medusa transferCartCustomerWorkflow).
 * Non-fatal on failure — login/checkout still proceed.
 */
export async function transferLocalCartToCustomer(): Promise<boolean> {
  const cartId = readStoredCartId()
  if (!cartId) return false
  const sdk = getMedusaClient()
  const token = await sdk.client.getToken()
  if (!token) return false
  try {
    await sdk.store.cart.transferCart(cartId)
    return true
  } catch {
    return false
  }
}

export function formatMoney(
  amount: number | null | undefined,
  currencyCode: string | null | undefined,
): string {
  if (amount == null || !Number.isFinite(amount)) return "—"
  const code = (currencyCode ?? "").toUpperCase() || "GHS"
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    }).format(amount)
  } catch {
    return `${code} ${amount}`
  }
}
