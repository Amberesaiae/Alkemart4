import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { medusaAmountToPesewas } from "@workspace/platform-config"
import { useMedusa } from "./medusa-provider"
import { commerceContext } from "./medusa/client"
import type { CommerceCart, ProductId, VariantId } from "./commerce/types"

/** UI cart shape aligned with CommerceCart. */
export type AlkemartCart = CommerceCart

function medusaToAlkemartCart(cart: any): AlkemartCart {
  return {
    id: cart.id,
    items: (cart.items ?? []).map((item: any) => ({
      id: item.id,
      qty: item.quantity,
      variantId: (item.variant_id ?? "") as VariantId,
      product: {
        title: item.product_title ?? item.title ?? "Untitled",
        pricePesewas: medusaAmountToPesewas(Number(item.unit_price ?? 0)),
        compareAtPesewas: undefined,
        imageUrl: item.thumbnail ?? "",
        productId: (item.product_id ?? "") as ProductId,
      },
    })),
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
    mutationFn: async (data: { variantId: string; qty: number }) => {
      const cartId = await ensureCartId(sdk)
      const variant_id = resolveVariantId(data)

      await sdk.store.cart.createLineItem(cartId, {
        variant_id,
        quantity: data.qty,
      })

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
        variantId: string
        qty: number
        /** @deprecated Prefer variantId only. */
        productId?: string | number
      }
    }) => {
      const cartId = await ensureCartId(sdk)
      const variant_id = resolveVariantId(params.data)

      await sdk.store.cart.createLineItem(cartId, {
        variant_id,
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

export function useListMyAddresses() {
  const sdk = useMedusa()

  return useQuery({
    queryKey: ["medusa", "addresses"],
    queryFn: async () => {
      try {
        const { customer } = await sdk.store.customer.retrieve()
        return { items: customer.addresses ?? [] }
      } catch {
        return { items: [] }
      }
    },
    retry: false,
    throwOnError: false,
    staleTime: 60000,
  })
}
