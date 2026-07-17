import { getMedusaClient } from "./medusa"

export type CustomerAddress = {
  id: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  address1?: string | null
  city?: string | null
  province?: string | null
  countryCode?: string | null
  postalCode?: string | null
  isDefaultShipping?: boolean
}

export type AddressInput = {
  first_name: string
  last_name: string
  phone: string
  address_1: string
  city: string
  province?: string
  country_code: string
  postal_code?: string
  is_default_shipping?: boolean
}

function mapAddress(raw: Record<string, unknown>): CustomerAddress {
  return {
    id: String(raw.id),
    firstName: (raw.first_name as string) ?? null,
    lastName: (raw.last_name as string) ?? null,
    phone: (raw.phone as string) ?? null,
    address1: (raw.address_1 as string) ?? null,
    city: (raw.city as string) ?? null,
    province: (raw.province as string) ?? null,
    countryCode: (raw.country_code as string) ?? null,
    postalCode: (raw.postal_code as string) ?? null,
    isDefaultShipping: Boolean(raw.is_default_shipping),
  }
}

export async function listMyAddresses(): Promise<CustomerAddress[]> {
  const sdk = getMedusaClient()
  const token = await sdk.client.getToken()
  if (!token) throw new Error("Sign in required to manage addresses")

  const { customer } = await sdk.store.customer.retrieve({
    fields: "*addresses",
  } as never)

  const list =
    ((customer as { addresses?: Record<string, unknown>[] }).addresses ??
      []) as Record<string, unknown>[]
  return list.map(mapAddress)
}

export async function createMyAddress(
  data: AddressInput,
): Promise<CustomerAddress[]> {
  const sdk = getMedusaClient()
  await sdk.store.customer.createAddress({
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    phone: data.phone.trim(),
    address_1: data.address_1.trim(),
    city: data.city.trim(),
    province: data.province?.trim() || undefined,
    country_code: data.country_code.trim().toLowerCase(),
    postal_code: data.postal_code?.trim() || undefined,
    is_default_shipping: data.is_default_shipping,
  } as never)
  return listMyAddresses()
}

export async function deleteMyAddress(addressId: string): Promise<void> {
  const sdk = getMedusaClient()
  await sdk.store.customer.deleteAddress(addressId)
}

/** Mark address as default shipping when the store API supports it. */
export async function setDefaultShippingAddress(
  addressId: string,
): Promise<CustomerAddress[]> {
  const sdk = getMedusaClient()
  await sdk.store.customer.updateAddress(addressId, {
    is_default_shipping: true,
  } as never)
  return listMyAddresses()
}
