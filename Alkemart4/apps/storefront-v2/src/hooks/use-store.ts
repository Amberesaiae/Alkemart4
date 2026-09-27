import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { addOfferToCart, removeLine, retrieveCart, updateLineQuantity } from "@/lib/cart"
import { getSessionCustomer } from "@/lib/auth"
import { listStoreCategories } from "@/lib/products"
import { trackProductAdded } from "@/lib/analytics"

/** Query keys shared by every surface — one cache entry per resource. */
export const qk = {
  cart: ["store", "cart"] as const,
  session: ["store", "session"] as const,
  categories: ["store", "categories"] as const,
  product: (id: string) => ["store", "product", id] as const,
}

export function useCart() {
  return useQuery({ queryKey: qk.cart, queryFn: () => retrieveCart(), staleTime: 30_000 })
}

export function useCartCount(): number {
  return useCart().data?.items.reduce((s, l) => s + l.quantity, 0) ?? 0
}

export function useSession() {
  return useQuery({ queryKey: qk.session, queryFn: () => getSessionCustomer(), staleTime: 60_000 })
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: () => listStoreCategories(),
    staleTime: 5 * 60_000,
  })
}

/** Add an offer (never a product) to the cart; toasts on success/failure. */
export function useAddToCart() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (input: {
      offerId: string
      qty?: number
      productId?: string
      title?: string
      price?: number | null
      currency?: string | null
    }) => addOfferToCart(input.offerId, input.qty ?? 1),
    onSuccess: (cart, input) => {
      queryClient.setQueryData(qk.cart, cart)
      trackProductAdded({
        productId: input.productId,
        offerId: input.offerId,
        quantity: input.qty ?? 1,
        price: input.price ?? null,
        currency: input.currency ?? null,
      })
      toast.success(input.title ? `Added “${input.title}”` : "Added to cart", {
        action: { label: "View cart", onClick: () => void navigate({ to: "/cart" }) },
      })
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't add to cart"),
  })
}

export function useCartLineMutations() {
  const queryClient = useQueryClient()
  const onSuccess = (cart: Awaited<ReturnType<typeof updateLineQuantity>>) =>
    queryClient.setQueryData(qk.cart, cart)
  const onError = (err: unknown) =>
    toast.error(err instanceof Error ? err.message : "Couldn't update your cart")
  const setQty = useMutation({
    mutationFn: ({ lineId, qty }: { lineId: string; qty: number }) =>
      updateLineQuantity(lineId, qty),
    onSuccess,
    onError,
  })
  const remove = useMutation({
    mutationFn: (lineId: string) => removeLine(lineId),
    onSuccess,
    onError,
  })
  const clear = useMutation({
    mutationFn: async (lineIds: string[]) => {
      let last = null as Awaited<ReturnType<typeof removeLine>> | null
      for (const id of lineIds) last = await removeLine(id)
      return last
    },
    onSuccess: (cart) => {
      if (cart) queryClient.setQueryData(qk.cart, cart)
    },
    onError,
  })
  return { setQty, remove, clear }
}
