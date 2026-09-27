/**
 * Checkout hand-off keys kept in sessionStorage (never the URL): the cart a
 * card payment belongs to, and the checkout email for guest order lookup.
 */
const CARD_CART = "alkemart.storefront.card_cart_id"
const LOOKUP_EMAIL = "alkemart.storefront.order_lookup_email"

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string | null) {
  try {
    if (value) sessionStorage.setItem(key, value)
    else sessionStorage.removeItem(key)
  } catch {
    /* private mode */
  }
}

export const cardCartId = { get: () => read(CARD_CART), set: (v: string | null) => write(CARD_CART, v) }
export const lookupEmail = { get: () => read(LOOKUP_EMAIL), set: (v: string | null) => write(LOOKUP_EMAIL, v) }
