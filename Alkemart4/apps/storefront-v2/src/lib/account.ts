/**
 * Buyer account (0037): profile, password, address book, password reset.
 * Errors propagate (with `status`) — the UI decides what to say.
 */
import { apiJson } from "./http"
import { getWorkersAccessToken, replaceSession } from "./auth"

export type Account = {
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  memberSince?: string
}

export type SavedAddress = {
  id: string
  label: string | null
  firstName: string
  lastName: string
  phone: string
  address1: string
  address2: string | null
  city: string
  province: string | null
  postalCode: string | null
  countryCode: string
  /** Pinned delivery spot, when the buyer dropped one. */
  latitude?: number | null
  longitude?: number | null
  isDefault: boolean
  updatedAt: string
}

export type AddressDraft = Omit<SavedAddress, "id" | "isDefault" | "updatedAt"> & { isDefault?: boolean }

const auth = () => ({ token: getWorkersAccessToken() })

export const getAccount = () => apiJson<{ account: Account }>("/store/account", auth()).then((r) => r.account)

export const updateAccount = (patch: Partial<Pick<Account, "firstName" | "lastName" | "phone">>) =>
  apiJson<{ account: Account }>("/store/account", { ...auth(), method: "PATCH", body: JSON.stringify(patch) }).then((r) => r.account)

/** Changes the password and swaps in the fresh session the API returns. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const s = await apiJson<{ token: string; user: { id: string; email: string; role: string } }>("/store/account/password", {
    ...auth(),
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  replaceSession(s)
}

export const listAddresses = () =>
  apiJson<{ addresses: SavedAddress[] }>("/store/account/addresses", auth()).then((r) => r.addresses)

export const createAddress = (a: AddressDraft) =>
  apiJson<{ address: SavedAddress }>("/store/account/addresses", { ...auth(), method: "POST", body: JSON.stringify(a) }).then(
    (r) => r.address,
  )

export const updateAddress = (id: string, a: Partial<AddressDraft>) =>
  apiJson<{ address: SavedAddress }>(`/store/account/addresses/${encodeURIComponent(id)}`, {
    ...auth(),
    method: "PATCH",
    body: JSON.stringify(a),
  }).then((r) => r.address)

export const setDefaultAddress = (id: string) =>
  apiJson<{ address: SavedAddress }>(`/store/account/addresses/${encodeURIComponent(id)}/default`, { ...auth(), method: "POST" })

export const deleteAddress = (id: string) =>
  apiJson<{ ok: true }>(`/store/account/addresses/${encodeURIComponent(id)}`, { ...auth(), method: "DELETE" })

export const requestPasswordReset = (email: string) =>
  apiJson<{ ok: true; message: string }>("/store/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email: email.trim() }),
  })

export const confirmPasswordReset = (token: string, password: string) =>
  apiJson<{ ok: true }>("/store/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password }) })

/** One line for lists and pickers: "Home · 12 Ring Road, Osu". */
export function addressSummary(a: Pick<SavedAddress, "label" | "address1" | "city">) {
  return [a.label, `${a.address1}, ${a.city}`].filter(Boolean).join(" · ")
}
