import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { products, orders, stats, seller, ApiError } from "./api"
import { getActiveSellerId } from "./api"

// --- Stats ---
export function useDashboardStats() {
  return useQuery({
    queryKey: ["vendor", "stats"],
    queryFn: () => stats.get(),
  })
}

// --- Orders ---
export function useOrders(params?: any) {
  return useQuery({
    queryKey: ["vendor", "orders", params],
    queryFn: () => orders.list(params),
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["vendor", "orders", id],
    queryFn: () => orders.get(id),
    enabled: !!id,
  })
}

export function useFulfillOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, items }: { orderId: string, items: any[] }) => 
      orders.createFulfillment(orderId, { items }),
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["vendor", "orders", orderId] })
      qc.invalidateQueries({ queryKey: ["vendor", "orders"] })
    }
  })
}

export function useShipOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, fulfillmentId, tracking }: { orderId: string, fulfillmentId: string, tracking?: string }) => 
      orders.markShipped(orderId, fulfillmentId, tracking ? [{ tracking_number: tracking }] : []),
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

// --- Products ---
export function useProducts() {
  return useQuery({
    queryKey: ["vendor", "products"],
    queryFn: () => products.list(),
  })
}

export function useQuickSell() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => products.quickList(data),
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
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => seller.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "profile"] })
  })
}

export function useUpdateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => seller.updateAddress(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "profile"] })
  })
}

export function useUpdatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => seller.updatePaymentDetails(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "profile"] })
  })
}
