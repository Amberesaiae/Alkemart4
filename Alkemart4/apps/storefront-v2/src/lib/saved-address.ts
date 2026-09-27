import type { CheckoutAddress } from "./checkout"

/**
 * Last-used delivery details, remembered on this device only when the buyer
 * opts in. Workers has no address book (LIFECYCLE-BUYER "Not in SoR yet");
 * this is a convenience, never an account feature, and one tap forgets it.
 */
const KEY = "alkemart.storefront.saved_delivery"

export type SavedDelivery = { email: string; address: CheckoutAddress; savedAt: string }

export function readSavedDelivery(): SavedDelivery | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as SavedDelivery | null
    return raw?.address?.phone && raw.address.address_1 ? raw : null
  } catch {
    return null
  }
}

export function writeSavedDelivery(value: { email: string; address: CheckoutAddress } | null): void {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify({ ...value, savedAt: new Date().toISOString() }))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode */
  }
}
