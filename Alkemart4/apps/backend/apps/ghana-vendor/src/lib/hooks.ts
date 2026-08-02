import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { products, orders, stats, seller, catalog, returns, onboarding, offers, inventoryItems, ApiError } from "./api"
import { getActiveSellerId } from "./api"

// --- Stats ---
export function useDashboardStats() {
  return useQuery({
    queryKey: ["vendor", "stats"],
    queryFn: () => stats.get(),
    staleTime: 30_000,
  })
}

// --- Orders ---
export function useOrders(params?: Record<string, string | number | boolean | undefined>) {
  return useQuery({
    queryKey: ["vendor", "orders", params],
    queryFn: () => orders.list(params),
    staleTime: 15_000,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["vendor", "orders", id],
    queryFn: () => orders.get(id),
    enabled: !!id,
    staleTime: 15_000,
  })
}

export function useFulfillOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, items }: { orderId: string, items: { id: string; quantity: number }[] }) => 
      orders.createFulfillment(orderId, { items }),
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["vendor", "orders", orderId] })
      qc.invalidateQueries({ queryKey: ["vendor", "orders"] })
      qc.invalidateQueries({ queryKey: ["vendor", "products"] })
      qc.invalidateQueries({ queryKey: ["vendor", "offers"] })
      qc.invalidateQueries({ queryKey: ["vendor", "stats"] })
    }
  })
}

export function useShipOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, fulfillmentId, tracking, trackingUrl }: { orderId: string, fulfillmentId: string, tracking?: string, trackingUrl?: string }) => 
      orders.markShipped(orderId, fulfillmentId, tracking || trackingUrl ? [{ tracking_number: tracking || "", tracking_url: trackingUrl || undefined }] : []),
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["vendor", "orders", orderId] })
      qc.invalidateQueries({ queryKey: ["vendor", "orders"] })
    }
  })
}

export function useDeliverOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, fulfillmentId }: { orderId: string, fulfillmentId: string }) => 
      orders.markDelivered(orderId, fulfillmentId),
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["vendor", "orders", orderId] })
      qc.invalidateQueries({ queryKey: ["vendor", "orders"] })
    }
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      orders.cancel(orderId, reason),
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["vendor", "orders", orderId] })
      qc.invalidateQueries({ queryKey: ["vendor", "orders"] })
    },
  })
}

// --- Products ---
export function useProducts(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["vendor", "products", params],
    queryFn: () => products.list(params),
    staleTime: 30_000,
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["vendor", "products", id],
    queryFn: () => products.get(id),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof products.update>[1] }) =>
      products.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "products"] })
    },
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => products.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "products"] })
      qc.invalidateQueries({ queryKey: ["vendor", "stats"] })
    },
  })
}

export function useQuickSell() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof products.quickList>[0]) => products.quickList(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "products"] })
      qc.invalidateQueries({ queryKey: ["vendor", "stats"] })
    }
  })
}

export function useProposeProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => products.propose(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "products"] })
  })
}

export function useUploadImage() {
  return useMutation({
    mutationFn: (file: File) => products.upload(file)
  })
}

// --- Seller Settings ---
export function useSellerProfile() {
  return useQuery({
    queryKey: ["vendor", "profile"],
    queryFn: () => seller.me(),
    staleTime: 60_000,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof seller.update>[0]) => seller.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "profile"] })
      qc.invalidateQueries({ queryKey: ["seller", "me"] })
    }
  })
}

export function useUpdateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: Parameters<typeof seller.updateAddress>[1] }) => seller.updateAddress(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "profile"] })
  })
}

export function useGhanaSetup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof onboarding.ghanaSetup>[0]) => onboarding.ghanaSetup(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "profile"] })
      qc.invalidateQueries({ queryKey: ["vendor", "readiness"] })
    }
  })
}

export function useReadiness() {
  return useQuery({
    queryKey: ["vendor", "readiness"],
    queryFn: () => stats.readiness(),
    staleTime: 30_000,
  })
}

export function useUpdatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: Parameters<typeof seller.updatePaymentDetails>[1] }) => seller.updatePaymentDetails(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "profile"] })
  })
}

// --- Returns ---
export function useReturns(params?: Record<string, string | number | boolean | undefined>) {
  return useQuery({
    queryKey: ["vendor", "returns", params],
    queryFn: () => returns.list(params),
    staleTime: 15_000,
  })
}

export function useReturn(id: string) {
  return useQuery({
    queryKey: ["vendor", "returns", id],
    queryFn: () => returns.get(id),
    enabled: !!id,
    staleTime: 15_000,
  })
}

export function useReturnReasons() {
  return useQuery({
    queryKey: ["vendor", "return-reasons"],
    queryFn: () => returns.reasons(),
    staleTime: 300_000,
  })
}

export function useReceiveReturnItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ returnId, items }: { returnId: string; items: { id: string; quantity: number }[] }) =>
      returns.receiveItems(returnId, { items }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "returns"] })
    }
  })
}

export function useConfirmReceiveReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ returnId }: { returnId: string }) =>
      returns.confirmReceive(returnId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "returns"] })
    }
  })
}

export function useDismissReturnItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ returnId, items }: { returnId: string; items: { id: string; quantity: number; internal_note?: string }[] }) =>
      returns.dismissItems(returnId, { items }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "returns"] })
    }
  })
}

export function useRefundPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ paymentId, amount }: { paymentId: string; amount?: number }) =>
      returns.refund(paymentId, { amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "returns"] })
      qc.invalidateQueries({ queryKey: ["vendor", "orders"] })
      qc.invalidateQueries({ queryKey: ["vendor", "stats"] })
    }
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ["vendor", "categories"],
    queryFn: () => catalog.categories(),
    staleTime: 120_000,
  })
}

// --- Offers ---
export function useProductOffers(productId: string) {
  return useQuery({
    queryKey: ["vendor", "offers", productId],
    queryFn: () => offers.list({ product_id: productId, limit: 50 }),
    enabled: !!productId,
    staleTime: 30_000,
  })
}

export function useOfferStockLevels(inventoryItemId: string | undefined) {
  return useQuery({
    queryKey: ["vendor", "stock-levels", inventoryItemId],
    queryFn: () => inventoryItems.levels(inventoryItemId as string),
    enabled: !!inventoryItemId,
    staleTime: 15_000,
  })
}

export function useSetStockLevel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      inventoryItemId,
      locationId,
      stockedQuantity,
    }: {
      inventoryItemId: string
      locationId: string
      stockedQuantity: number
    }) => inventoryItems.setLevel(inventoryItemId, locationId, stockedQuantity),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["vendor", "stock-levels", vars.inventoryItemId] })
      qc.invalidateQueries({ queryKey: ["vendor", "offers"] })
    },
  })
}

export function useUpdateOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { prices?: { amount: number; currency_code: string }[]; sku?: string } }) =>
      offers.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "offers"] })
    },
  })
}
