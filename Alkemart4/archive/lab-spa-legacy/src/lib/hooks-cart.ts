import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { medusaAmountToPesewas } from "@workspace/platform-config"
import { useMedusa } from "./medusa-provider"
import { commerceContext } from "./medusa/client"
import type { CommerceCart, ProductId, VariantId } from "./commerce/types"

/** UI cart shape aligned with CommerceCart. */
export type AlkemartCart = CommerceCart

/** Create/update address form payload (shared by address form + Medusa hooks). */
export type AddressFormValues = {
  label?: string
  fullName: string
  phone: string
  line1: string
  city: string
  region?: string
  digitalAddress?: string
  countryCode?: string
  isDefault?: boolean
}

/** UI address shape (Medusa customer addresses mapped for SPA components). */
export type AlkemartAddress = {
  id: string
  fullName: string
  phone: string
  line1: string
  city: string
  region?: string
  digitalAddress?: string
  countryCode?: string
  isDefault: boolean
  label?: string
}

/** Map Medusa store customer address → SPA Address fields. */
export function medusaAddressToAlkemart(addr: any): AlkemartAddress {
  const first = (addr.first_name ?? "").trim()
  const last = (addr.last_name ?? "").trim()
  const fullName =
    [first, last].filter(Boolean).join(" ") ||
    (addr.company as string | undefined)?.trim() ||
    "Address"
  return {
    id: String(addr.id),
    fullName,
    phone: String(addr.phone ?? ""),
    line1: String(addr.address_1 ?? ""),
    city: String(addr.city ?? ""),
    region: addr.province ? String(addr.province) : undefined,
    digitalAddress: addr.postal_code
      ? String(addr.postal_code)
      : addr.metadata?.digital_address
        ? String(addr.metadata.digital_address)
        : undefined,
    countryCode: addr.country_code
      ? String(addr.country_code).toUpperCase()
      : "GH",
    isDefault: Boolean(addr.is_default_shipping ?? addr.is_default_billing),
    label: addr.address_name ? String(addr.address_name) : undefined,
  }
}

function formToMedusaAddressBody(data: AddressFormValues) {
  const full = data.fullName.trim()
  const parts = full.split(/\s+/)
  const first_name = parts[0] || full || "Customer"
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : ""
  const country = (data.countryCode || "GH").toUpperCase()

  return {
    first_name,
    last_name,
    phone: data.phone.trim(),
    address_1: data.line1.trim(),
    city: data.city.trim(),
    province: data.region?.trim() || undefined,
    country_code: country.length === 2 ? country.toLowerCase() : "gh",
    postal_code: data.digitalAddress?.trim() || undefined,
    address_name: data.label?.trim() || undefined,
    is_default_shipping: Boolean(data.isDefault),
    metadata: data.digitalAddress?.trim()
      ? { digital_address: data.digitalAddress.trim() }
      : undefined,
  }
}

function medusaToAlkemartCart(cart: any): AlkemartCart {
  return {
    id: cart.id,
    items: (cart.items ?? []).map((item: any) => {
      const meta = (item.metadata ?? item.product?.metadata ?? {}) as Record<string, unknown>
      const vendorName =
        typeof meta.seller_name === "string"
          ? meta.seller_name
          : typeof meta.vendor_name === "string"
            ? meta.vendor_name
            : typeof item.product?.seller?.name === "string"
              ? item.product.seller.name
              : null

      return {
        id: item.id,
        qty: item.quantity,
        variantId: (item.variant_id ?? "") as VariantId,
        product: {
          title: item.product_title ?? item.title ?? "Untitled",
          pricePesewas: medusaAmountToPesewas(Number(item.unit_price ?? 0)),
          compareAtPesewas: undefined,
          imageUrl: item.thumbnail ?? "",
          productId: (item.product_id ?? "") as ProductId,
          vendorName,
        },
      }
    }),
    subtotalPesewas: medusaAmountToPesewas(Number(cart.total ?? cart.subtotal ?? 0)),
  }
}

async function ensureCartId(sdk: ReturnType<typeof useMedusa>): Promise<string> {
  let cartId = localStorage.getItem("alkemart:cart_id")
  if (cartId) return cartId

  const region_id = commerceContext.regionId()
  const sales_channel_id = commerceContext.salesChannelId()

  const { cart } = await sdk.store.cart.create({
    region_id,
    sales_channel_id,
  })
  cartId = cart.id
  localStorage.setItem("alkemart:cart_id", cartId!)
  return cartId!
}

function resolveVariantId(data: {
  variantId?: string
  /** @deprecated Use variantId — product ids are not valid for line items. */
  productId?: string | number
}): string {
  const variantId = data.variantId?.trim()
  if (variantId) return variantId

  // Do not send prod_* as variant_id — Medusa will reject or mis-route.
  throw new Error("Product has no purchasable variant")
}

/**
 * Mercur marketplace carts require `offer_id` (not `variant_id`).
 * Vanilla Medusa uses `variant_id`. Prefer offer when present.
 */
function lineItemBody(data: {
  offerId?: string | null
  variantId?: string
  qty: number
}): { offer_id: string; quantity: number } | { variant_id: string; quantity: number } {
  const offerId = data.offerId?.trim()
  if (offerId) {
    return { offer_id: offerId, quantity: data.qty }
  }
  return { variant_id: resolveVariantId(data), quantity: data.qty }
}

export function useGetCart() {
  const sdk = useMedusa()

  return useQuery({
    queryKey: ["medusa", "cart"],
    queryFn: async () => {
      const cartId = localStorage.getItem("alkemart:cart_id")
      if (!cartId) return null
      try {
        const { cart } = await sdk.store.cart.retrieve(cartId)
        return medusaToAlkemartCart(cart)
      } catch {
        localStorage.removeItem("alkemart:cart_id")
        return null
      }
    },
    retry: false,
    throwOnError: false,
  })
}

export function useCreateCart() {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      variantId?: string
      offerId?: string | null
      qty: number
    }) => {
      const cartId = await ensureCartId(sdk)
      await sdk.store.cart.createLineItem(cartId, lineItemBody(data) as any)

      const { cart } = await sdk.store.cart.retrieve(cartId)
      return medusaToAlkemartCart(cart)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "cart"] })
    },
  })
}

export function useAddCartItem() {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      data: {
        variantId?: string
        /** Mercur offer id — required for multi-vendor cart lines. */
        offerId?: string | null
        qty: number
        /** @deprecated Prefer variantId / offerId. */
        productId?: string | number
      }
    }) => {
      const cartId = await ensureCartId(sdk)
      await sdk.store.cart.createLineItem(cartId, lineItemBody(params.data) as any)

      const { cart } = await sdk.store.cart.retrieve(cartId)
      return medusaToAlkemartCart(cart)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "cart"] })
    },
  })
}

export function useUpdateCartItem() {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; data: { qty: number } }) => {
      const cartId = localStorage.getItem("alkemart:cart_id")
      if (!cartId) throw new Error("No cart")

      await sdk.store.cart.updateLineItem(cartId, params.id, {
        quantity: params.data.qty,
      })

      const { cart } = await sdk.store.cart.retrieve(cartId)
      return medusaToAlkemartCart(cart)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "cart"] })
    },
  })
}

export function useRemoveCartItem() {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string }) => {
      const cartId = localStorage.getItem("alkemart:cart_id")
      if (!cartId) throw new Error("No cart")

      await sdk.store.cart.deleteLineItem(cartId, params.id)

      const { cart } = await sdk.store.cart.retrieve(cartId)
      return medusaToAlkemartCart(cart)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "cart"] })
    },
  })
}

export function useListMyAddresses(opts?: {
  query?: {
    enabled?: boolean
    retry?: boolean
    throwOnError?: boolean
    staleTime?: number
  }
}) {
  const sdk = useMedusa()

  return useQuery<{ items: AlkemartAddress[] }>({
    queryKey: ["medusa", "addresses"],
    queryFn: async () => {
      try {
        const { customer } = await sdk.store.customer.retrieve({
          fields: "+addresses",
        })
        const raw = (customer.addresses ?? []) as unknown[]
        const items: AlkemartAddress[] = raw.map(medusaAddressToAlkemart)
        return { items }
      } catch {
        return { items: [] }
      }
    },
    retry: opts?.query?.retry ?? false,
    throwOnError: opts?.query?.throwOnError ?? false,
    staleTime: opts?.query?.staleTime ?? 60000,
    enabled: opts?.query?.enabled,
  })
}

export function useCreateMyAddress(opts?: {
  mutation?: { onSuccess?: (addr: AlkemartAddress) => void }
}) {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { data: AddressFormValues }) => {
      const body = formToMedusaAddressBody(params.data)
      const { customer } = await sdk.store.customer.createAddress(body)
      const addresses: AlkemartAddress[] = (
        (customer.addresses ?? []) as unknown[]
      ).map(medusaAddressToAlkemart)
      // Prefer newly created (last matching address_1 + phone) or last in list.
      const created =
        addresses.find(
          (a: AlkemartAddress) =>
            a.line1 === body.address_1 &&
            a.phone === body.phone,
        ) ?? addresses[addresses.length - 1]
      if (!created) {
        throw new Error("Address created but could not be read back")
      }
      return created
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "addresses"] })
      opts?.mutation?.onSuccess?.(data)
    },
  })
}

export function useUpdateMyAddress(opts?: {
  mutation?: { onSuccess?: (addr: AlkemartAddress) => void }
}) {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; data: AddressFormValues }) => {
      const body = formToMedusaAddressBody(params.data)
      const { customer } = await sdk.store.customer.updateAddress(params.id, body)
      const addresses: AlkemartAddress[] = (
        (customer.addresses ?? []) as unknown[]
      ).map(medusaAddressToAlkemart)
      const updated =
        addresses.find((a: AlkemartAddress) => a.id === params.id) ?? addresses[0]
      if (!updated) throw new Error("Address update failed")
      return updated
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "addresses"] })
      opts?.mutation?.onSuccess?.(data)
    },
  })
}

export function useDeleteMyAddress(opts?: {
  mutation?: { onSuccess?: () => void }
}) {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string } | string) => {
      const id = typeof params === "string" ? params : params.id
      await sdk.store.customer.deleteAddress(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "addresses"] })
      opts?.mutation?.onSuccess?.()
    },
  })
}
