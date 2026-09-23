import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  products,
  orders,
  stats,
  tasks,
  health,
  shopTraffic,
  seller,
  catalog,
  returns,
  onboarding,
  offers,
  inventoryItems,
  vendorReviews,
  payouts,
  collections,
  alertPrefs,
} from "./api"

// --- Account health ---
export function useHealth() {
  return useQuery({
    queryKey: ["vendor", "health"],
    queryFn: () => health.get(),
    staleTime: 60_000,
    retry: false,
  })
}

// --- Alert preferences (dashboard task topics, Phase 7C) ---
export function useAlertPrefs() {
  return useQuery({
    queryKey: ["vendor", "preferences"],
    queryFn: () => alertPrefs.list(),
    staleTime: 60_000,
    retry: false,
  })
}

export function useSetAlertPref() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ topic, optedIn }: { topic: string; optedIn: boolean }) =>
      alertPrefs.set(topic, optedIn),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vendor", "preferences"] })
      void qc.invalidateQueries({ queryKey: ["vendor", "tasks"] })
    },
  })
}
export function usePayoutStatement() {
  return useQuery({
    queryKey: ["vendor", "payouts", "statement"],
    queryFn: () => payouts.statement(),
    staleTime: 30_000,
    retry: false,
  })
}

// --- Collections (shelves) ---
export function useCollections() {
  return useQuery({
    queryKey: ["vendor", "collections"],
    queryFn: () => collections.list(),
    staleTime: 30_000,
    retry: false,
  })
}

function invalidateCollections(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["vendor", "collections"] })
}

export function useCreateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string }) => collections.create(input),
    onSuccess: () => invalidateCollections(qc),
  })
}

export function useUpdateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: {
      id: string
      patch: {
        name?: string
        description?: string | null
        visibility?: "draft" | "published"
        startsAt?: string | null
        endsAt?: string | null
      }
    }) => collections.update(id, patch),
    onSuccess: () => invalidateCollections(qc),
  })
}

export function useDeleteCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => collections.remove(id),
    onSuccess: () => invalidateCollections(qc),
  })
}

export function useSetCollectionProducts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, productIds }: { id: string; productIds: string[] }) =>
      collections.setProducts(id, productIds),
    onSuccess: () => invalidateCollections(qc),
  })
}
export function useTasks() {
  return useQuery({
    queryKey: ["vendor", "tasks"],
    queryFn: () => tasks.list(),
    staleTime: 30_000,
    retry: false,
  })
}

// --- Stats ---
export function useDashboardStats() {
  return useQuery({
    queryKey: ["vendor", "stats"],
    queryFn: () => stats.get(),
    staleTime: 30_000,
    // Workers soft-fails inside stats.get; never block the dashboard on stats.
    retry: false,
  })
}

// --- Shop traffic ---
export function useShopTraffic() {
  return useQuery({
    queryKey: ["vendor", "shop-traffic"],
    queryFn: () => shopTraffic.get(),
    staleTime: 60_000,
    retry: false,
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
    mutationFn: ({
      orderId,
      fulfillmentId,
      tracking,
      trackingUrl,
    }: {
      orderId: string
      fulfillmentId?: string
      tracking?: string
      trackingUrl?: string
    }) =>
      orders.markShipped(
        orderId,
        fulfillmentId || "workers",
        tracking || trackingUrl
          ? [{ tracking_number: tracking || "", tracking_url: trackingUrl || undefined }]
          : [],
      ),
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["vendor", "orders", orderId] })
      qc.invalidateQueries({ queryKey: ["vendor", "orders"] })
      qc.invalidateQueries({ queryKey: ["vendor", "stats"] })
    },
  })
}

export function useDeliverOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      fulfillmentId,
    }: {
      orderId: string
      fulfillmentId?: string
    }) => orders.markDelivered(orderId, fulfillmentId || "workers"),
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["vendor", "orders", orderId] })
      qc.invalidateQueries({ queryKey: ["vendor", "orders"] })
      qc.invalidateQueries({ queryKey: ["vendor", "stats"] })
    },
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

export function useUpdateVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, variantId, patch }: {
      productId: string
      variantId: string
      patch: {
        pricePesewas?: string
        onHand?: number
        active?: boolean
        condition?: string | null
        compareAtPesewas?: string | null
        compareAtProvenance?: string | null
        fulfillmentOrigin?: string | null
        warrantyRef?: string | null
        returnsRef?: string | null
        deliveryPromise?: string | null
      }
    }) => products.updateVariant(productId, variantId, patch),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["vendor", "products", vars.productId] })
      qc.invalidateQueries({ queryKey: ["vendor", "products"] })
    },
  })
}

export function useAddOptionValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, input }: {
      productId: string
      input: { optionId?: string; optionName?: string; value: string; existingValue?: string }
    }) => products.addOptionValue(productId, input),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["vendor", "products", vars.productId] })
      qc.invalidateQueries({ queryKey: ["vendor", "products"] })
    },
  })
}

export function useSetOptionValueImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, valueId, imageUrl }: { productId: string; valueId: string; imageUrl: string | null }) =>
      products.setOptionValueImage(productId, valueId, imageUrl),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["vendor", "products", vars.productId] })
      qc.invalidateQueries({ queryKey: ["vendor", "products"] })
    },
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

export function useUpdateSeller() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof seller.update>[0]) => seller.update(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "profile"] })
      qc.invalidateQueries({ queryKey: ["seller", "me"] })
    },
  })
}

export function useUpdateStorefront() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Parameters<typeof seller.updateStorefront>[0]) => seller.updateStorefront(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", "profile"] })
    }
  })
}

export function usePauseShop() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof seller.pause>[0]) => seller.pause(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "profile"] }),
  })
}

export function useUnpauseShop() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => seller.unpause(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "profile"] }),
  })
}

export function useShopPolicies() {
  return useQuery({
    queryKey: ["vendor", "policies"],
    queryFn: () => seller.policies(),
    staleTime: 30_000,
  })
}

export function useSavePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof seller.savePolicy>[0]) => seller.savePolicy(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "policies"] }),
  })
}

export function useUpdateDisplay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Parameters<typeof seller.updateDisplay>[0]) => seller.updateDisplay(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "profile"] }),
  })
}

export function useUpdateDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (minutes: number | null) => seller.updateDelivery(minutes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "profile"] }),
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Parameters<typeof seller.updateContact>[0]) => seller.updateContact(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "profile"] }),
  })
}

export function useFeatured() {
  return useQuery({
    queryKey: ["vendor", "featured"],
    queryFn: () => seller.featured(),
    staleTime: 30_000,
  })
}

export function useSetFeatured() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => seller.setFeatured(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "featured"] }),
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
    queryFn: async () => {
      const res = await offers.list({ limit: 100 })
      const productOffers = res.offers.filter((o) => o.product_id === productId)
      return { ...res, offers: productOffers, count: productOffers.length }
    },
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

export function useVendorReviews() {
  return useQuery({
    queryKey: ["vendor", "reviews"],
    queryFn: () => vendorReviews.mine(),
    staleTime: 30_000,
  })
}

export function useRespondReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => vendorReviews.respond(id, message),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor", "reviews"] }),
  })
}
