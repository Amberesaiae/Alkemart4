/**
 * ============================================================================
 * LEGACY EXPRESS /api STUBS — REFERENCE ONLY (NOT PRODUCTION SPA RUNTIME)
 * ============================================================================
 * These hooks hit the legacy Express `/api` backend (`artifacts/api-server`).
 *
 * - Production builds must NOT depend on this module. Dual-homed `/api` usage
 *   is a temporary migration bridge only.
 * - Replace callers with Medusa SDK / custom Medusa routes as features migrate.
 * - Do NOT add new callers to this file. Port surfaces listed in
 *   `docs/architecture/express-port-inventory.md`.
 *
 * Express remains the behavioral reference for commercial spine logic until
 * each capability is reimplemented under Medusa and this file is deleted.
 * ============================================================================
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch { /* ignore */ }
    const err = new Error(message) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Payment enums (used in checkout) ────────────────────────────────────────
export const OrderPaymentMethod = {
  momo: "momo",
  cash_on_delivery: "cash_on_delivery",
} as const

export const MomoProvider = {
  mtn: "mtn",
  vodafone: "vodafone",
  airteltigo: "airteltigo",
} as const

// ── Checkout ────────────────────────────────────────────────────────────────
export function useCheckout(opts?: { mutation?: { onSuccess?: (order: any) => void } }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { data: any }) =>
      apiFetch<any>("/checkout", { method: "POST", body: JSON.stringify(params.data) }),
    onSuccess: (data) => {
      opts?.mutation?.onSuccess?.(data)
    },
  })
}

// ── Address management ──────────────────────────────────────────────────────
export function useCreateMyAddress(opts?: { mutation?: { onSuccess?: (addr: any) => void } }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { data: any }) =>
      apiFetch<any>("/addresses", { method: "POST", body: JSON.stringify(params.data) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["medusa", "addresses"] })
      opts?.mutation?.onSuccess?.(data)
    },
  })
}

export function useUpdateMyAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: number; data: any }) =>
      apiFetch<any>(`/addresses/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medusa", "addresses"] })
    },
  })
}

export function useDeleteMyAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medusa", "addresses"] })
    },
  })
}

// ── Order cancel / dispute ──────────────────────────────────────────────────
export function useCancelMyOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) =>
      apiFetch<void>(`/orders/${orderId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medusa", "orders"] })
    },
  })
}

export function useCreateMyDispute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { orderId: string; reason: string; details?: string }) =>
      apiFetch<any>(`/orders/${data.orderId}/disputes`, {
        method: "POST",
        body: JSON.stringify({ reason: data.reason, details: data.details }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medusa", "orders"] })
    },
  })
}

// ── Homepage sections ───────────────────────────────────────────────────────
export function useListHomepageSections() {
  return useQuery({
    queryKey: ["api", "homepage", "sections"],
    queryFn: () => apiFetch<{ items: any[]; total: number }>("/homepage/sections"),
    retry: false,
    throwOnError: false,
    staleTime: 300000,
  })
}

export function getListAdminHomepageSectionsQueryKey() {
  return ["api", "admin", "homepage", "sections"] as const
}

// ── Admin analytics ─────────────────────────────────────────────────────────
export function useGetAdminAnalytics() {
  return useQuery({
    queryKey: ["api", "admin", "analytics"],
    queryFn: () => apiFetch<any>("/admin/analytics"),
    retry: false,
    throwOnError: false,
  })
}

// ── Vendor analytics ────────────────────────────────────────────────────────
export function useGetVendorAnalytics() {
  return useQuery({
    queryKey: ["api", "vendor", "analytics"],
    queryFn: () => apiFetch<any>("/vendor/analytics"),
    retry: false,
    throwOnError: false,
  })
}

// ── Conversations / messages ────────────────────────────────────────────────
export function useListMyConversations() {
  return useQuery({
    queryKey: ["api", "conversations"],
    queryFn: () => apiFetch<{ items: any[] }>("/conversations"),
    retry: false,
    throwOnError: false,
  })
}

export function getListMyConversationsQueryKey() {
  return ["api", "conversations"] as const
}

// ── Admin vendors ───────────────────────────────────────────────────────────
export function useListAdminVendors() {
  return useQuery({
    queryKey: ["api", "admin", "vendors"],
    queryFn: () => apiFetch<{ items: any[] }>("/admin/vendors"),
    retry: false,
    throwOnError: false,
  })
}

export function useUpdateAdminVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: number; data: any }) =>
      apiFetch<any>(`/admin/vendors/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "vendors"] })
    },
  })
}

// ── Admin promotions ────────────────────────────────────────────────────────
export function useListAdminPromotions() {
  return useQuery({
    queryKey: ["api", "admin", "promotions"],
    queryFn: () => apiFetch<{ items: any[] }>("/admin/promotions"),
    retry: false,
    throwOnError: false,
  })
}

export function useCreateAdminPromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch<any>("/admin/promotions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "promotions"] })
    },
  })
}

export function useUpdateAdminPromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: number; data: any }) =>
      apiFetch<any>(`/admin/promotions/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "promotions"] })
    },
  })
}

export function useDeleteAdminPromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/admin/promotions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "promotions"] })
    },
  })
}

// ── Admin inbox ─────────────────────────────────────────────────────────────
export function useListAdminInbox() {
  return useQuery({
    queryKey: ["api", "admin", "inbox"],
    queryFn: () => apiFetch<{ items: any[] }>("/admin/inbox"),
    retry: false,
    throwOnError: false,
  })
}

export function useAdminSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { conversationId: number; message: string }) =>
      apiFetch<any>(`/admin/inbox/${data.conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: data.message }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "inbox"] })
    },
  })
}

// ── Admin images ────────────────────────────────────────────────────────────
export function useListAdminImages() {
  return useQuery({
    queryKey: ["api", "admin", "images"],
    queryFn: () => apiFetch<{ items: any[] }>("/admin/images"),
    retry: false,
    throwOnError: false,
  })
}

export function useUpdateAdminImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: number; data: any }) =>
      apiFetch<any>(`/admin/images/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "images"] })
    },
  })
}

// ── Admin homepage sections ─────────────────────────────────────────────────
export function useUpdateAdminHomepageSections() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch<any>("/admin/homepage/sections", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "homepage", "sections"] })
      qc.invalidateQueries({ queryKey: ["api", "homepage", "sections"] })
    },
  })
}

// ── Admin disputes ──────────────────────────────────────────────────────────
export function useListAdminDisputes() {
  return useQuery({
    queryKey: ["api", "admin", "disputes"],
    queryFn: () => apiFetch<{ items: any[] }>("/admin/disputes"),
    retry: false,
    throwOnError: false,
  })
}

export function useUpdateAdminDispute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: number; data: any }) =>
      apiFetch<any>(`/admin/disputes/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "disputes"] })
    },
  })
}

// ── Support ─────────────────────────────────────────────────────────────────
export function useListMySupportTickets() {
  return useQuery({
    queryKey: ["api", "support"],
    queryFn: () => apiFetch<{ items: any[] }>("/support"),
    retry: false,
    throwOnError: false,
  })
}

export function useCreateSupportTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch<any>("/support", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "support"] })
    },
  })
}

// ── Vendor products ─────────────────────────────────────────────────────────
export function useListVendorProducts() {
  return useQuery({
    queryKey: ["api", "vendor", "products"],
    queryFn: () => apiFetch<{ items: any[] }>("/vendor/products"),
    retry: false,
    throwOnError: false,
  })
}

export function useCreateVendorProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch<any>("/vendor/products", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "vendor", "products"] })
    },
  })
}

export function useUpdateVendorProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: number; data: any }) =>
      apiFetch<any>(`/vendor/products/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "vendor", "products"] })
    },
  })
}

export function useDeleteVendorProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/vendor/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "vendor", "products"] })
    },
  })
}

// ── Vendor orders ───────────────────────────────────────────────────────────
export function useListVendorOrders() {
  return useQuery({
    queryKey: ["api", "vendor", "orders"],
    queryFn: () => apiFetch<{ items: any[] }>("/vendor/orders"),
    retry: false,
    throwOnError: false,
  })
}

export function useFulfillVendorOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) =>
      apiFetch<any>(`/vendor/orders/${orderId}/fulfill`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "vendor", "orders"] })
    },
  })
}

// ── Vendor messages ─────────────────────────────────────────────────────────
export function useListVendorMessages() {
  return useQuery({
    queryKey: ["api", "vendor", "messages"],
    queryFn: () => apiFetch<{ items: any[] }>("/vendor/messages"),
    retry: false,
    throwOnError: false,
  })
}

export function useSendVendorMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { conversationId: number; message: string }) =>
      apiFetch<any>(`/vendor/messages/${data.conversationId}`, {
        method: "POST",
        body: JSON.stringify({ message: data.message }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "vendor", "messages"] })
    },
  })
}

// ── Admin vendor list (name map for order detail) ───────────────────────────
export function useListAdminVendorsSimple() {
  return useQuery({
    queryKey: ["api", "admin", "vendors", "simple"],
    queryFn: () => apiFetch<{ items: any[] }>("/admin/vendors?fields=id,name,slug"),
    retry: false,
    throwOnError: false,
    staleTime: 300000,
  })
}

// ── Query key helpers ────────────────────────────────────────────────────────
export function getListAdminVendorsQueryKey() {
  return ["api", "admin", "vendors"] as const
}

export function getListAdminPromotionsQueryKey() {
  return ["api", "admin", "promotions"] as const
}

export function getListAdminDisputesQueryKey() {
  return ["api", "admin", "disputes"] as const
}

export function getListAdminImagesQueryKey() {
  return ["api", "admin", "images"] as const
}

export function getListVendorProductsQueryKey() {
  return ["api", "vendor", "products"] as const
}

export function getListVendorOrdersQueryKey() {
  return ["api", "vendor", "orders"] as const
}

export function getListMyImagesQueryKey() {
  return ["api", "vendor", "images"] as const
}

export function getGetVendorShopQueryKey() {
  return ["api", "vendor", "shop"] as const
}

// ── Admin vendor status update ───────────────────────────────────────────────
export function useUpdateAdminVendorStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: number; data: any }) =>
      apiFetch<any>(`/admin/vendors/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "vendors"] })
    },
  })
}

// ── Admin conversation ───────────────────────────────────────────────────────
export function useCreateAdminConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { data: { userId: number; subject: string } }) =>
      apiFetch<any>("/admin/conversations", {
        method: "POST",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "conversations"] })
    },
  })
}

export function useListAdminConversations() {
  return useQuery({
    queryKey: ["api", "admin", "conversations"],
    queryFn: () => apiFetch<{ items: any[] }>("/admin/conversations"),
    retry: false,
    throwOnError: false,
  })
}

export function getListAdminConversationsQueryKey() {
  return ["api", "admin", "conversations"] as const
}

// ── Conversation messages ────────────────────────────────────────────────────
export function useListConversationMessages(conversationId: number, opts?: { query?: { queryKey?: any; refetchInterval?: number } }) {
  return useQuery({
    queryKey: opts?.query?.queryKey ?? ["api", "conversations", conversationId, "messages"],
    queryFn: () => apiFetch<{ items: any[] }>(`/conversations/${conversationId}/messages`),
    refetchInterval: opts?.query?.refetchInterval,
    retry: false,
    throwOnError: false,
  })
}

export function getListConversationMessagesQueryKey(conversationId: number) {
  return ["api", "conversations", conversationId, "messages"] as const
}

export function useCreateConversationMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: number; data: { body: string } }) =>
      apiFetch<any>(`/conversations/${params.id}/messages`, {
        method: "POST",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "conversations"] })
    },
  })
}

// ── My conversation (buyer support) ──────────────────────────────────────────
export function useCreateMyConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { data: { subject: string; message: string } }) =>
      apiFetch<any>("/conversations", {
        method: "POST",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "conversations"] })
    },
  })
}

// ── Vendor shop ──────────────────────────────────────────────────────────────
export function useGetVendorShop() {
  return useQuery({
    queryKey: ["api", "vendor", "shop"],
    queryFn: () => apiFetch<any>("/vendor/shop"),
    retry: false,
    throwOnError: false,
  })
}

// ── Vendor images ────────────────────────────────────────────────────────────
export function useListMyImages() {
  return useQuery({
    queryKey: ["api", "vendor", "images"],
    queryFn: () => apiFetch<{ items: any[] }>("/vendor/images"),
    retry: false,
    throwOnError: false,
  })
}

// ── Vendor order fulfillment ─────────────────────────────────────────────────
export function useUpdateVendorOrderFulfillment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { orderId: number; data: { status: string } }) =>
      apiFetch<any>(`/vendor/orders/${params.orderId}/fulfillment`, {
        method: "PATCH",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "vendor", "orders"] })
    },
  })
}

// ── Admin homepage sections list ─────────────────────────────────────────────
export function useListAdminHomepageSections() {
  return useQuery({
    queryKey: ["api", "admin", "homepage", "sections"],
    queryFn: () => apiFetch<{ items: any[] }>("/admin/homepage/sections"),
    retry: false,
    throwOnError: false,
  })
}

// ── Admin image moderation ───────────────────────────────────────────────────
export function useApproveAdminImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: number }) =>
      apiFetch<any>(`/admin/images/${params.id}/approve`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "images"] })
    },
  })
}

export function useRejectAdminImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: number; data: { reason: string } }) =>
      apiFetch<any>(`/admin/images/${params.id}/reject`, {
        method: "POST",
        body: JSON.stringify(params.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api", "admin", "images"] })
    },
  })
}

// ── Image upload ─────────────────────────────────────────────────────────────
export function useRequestImageUploadUrl() {
  return useMutation({
    mutationFn: (params: { data: { name: string; size: number; contentType: string } }) =>
      apiFetch<{ uploadURL: string; objectPath: string }>("/images/upload-url", {
        method: "POST",
        body: JSON.stringify(params.data),
      }),
  })
}

export function useRegisterImage() {
  return useMutation({
    mutationFn: (params: { data: { objectPath: string; targetType: string; targetId: number | null } }) =>
      apiFetch<any>("/images/register", {
        method: "POST",
        body: JSON.stringify(params.data),
      }),
  })
}

export type ImageTargetType = "product" | "vendor_logo" | "vendor_banner" | "homepage_section"

// ── Product type ─────────────────────────────────────────────────────────────
export type Product = {
  id: number
  title: string
  pricePesewas: number
  stock: number
  isActive: boolean
  imageUrl?: string | null
  categoryId?: number
  tag?: string
  brand?: string
}

// ── Password reset (old API) ────────────────────────────────────────────────
export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: { email: string }) =>
      apiFetch<void>("/auth/forgot-password", { method: "POST", body: JSON.stringify(data) }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { token: string; password: string }) =>
      apiFetch<void>("/auth/reset-password", { method: "POST", body: JSON.stringify(data) }),
  })
}

// ── Old API type stubs (used in type annotations across admin/vendor routes) ─
export type AdminVendor = {
  id: number; name: string; slug: string; status: string; commissionBps: number;
  ratingAvgX100: number; ratingCount: number; ownerUserId?: number | null;
  logoImageUrl?: string | null; bannerImageUrl?: string | null; bio?: string | null;
}
export type Promotion = { id: number; code: string; discountType: string; value: number; minOrderPesewas?: number; usageLimit?: number; endsAt?: string; isActive: boolean }
export const PromotionDiscountType = { percentage: "percentage", fixed: "fixed" } as const
export type PromotionDiscountTypeType = "percentage" | "fixed"
export type Conversation = { id: number; subject: string; lastMessageAt: string; status: string; customerName?: string; customerEmail?: string }
export type ConversationSummary = { id: number; subject: string; lastMessage: string; unread: boolean; status: string; customerName?: string; customerEmail?: string }
export type Image = { id: number; imageUrl: string; targetType: string; targetId?: number | null; status: ImageStatus; rejectionReason?: string | null; width?: number; height?: number; sizeBytes?: number; contentType?: string; createdAt: string }
export type ImageStatus = "pending" | "approved" | "rejected"
export type HomepageSection = { id: number; type: string; sortOrder: number; enabled: boolean; config: Record<string, unknown>; imageUrl?: string | null }
export type Dispute = {
  id: number; orderId: number; subject: string; status: "open" | "resolved_buyer" | "resolved_seller";
  buyerUserId?: number | null;
  order?: { id: number; totalPesewas: number; paymentMethod: string;
    paymentEvents: { type: string }[];
    fulfillments: { id: number; status: string }[];
    items: { id: number; qty: number; titleSnapshot: string; subtotalPesewas: number }[];
  } | null;
}
export type VendorOrderItem = {
  id: number; orderId: number; orderCreatedAt: string; titleSnapshot: string;
  qty: number; subtotalPesewas: number; orderStatus: OrderStatusType;
  fulfillmentStatus: FulfillmentStatusType;
}
export const OrderStatus = { pending: "pending", confirmed: "confirmed", fulfilled: "fulfilled", cancelled: "cancelled" } as const
export type OrderStatusType = "pending" | "confirmed" | "fulfilled" | "cancelled"
export const FulfillmentStatus = { unfulfilled: "unfulfilled", packed: "packed", shipped: "shipped", delivered: "delivered" } as const
export type FulfillmentStatusType = "unfulfilled" | "packed" | "shipped" | "delivered"
export type Address = { id: number; fullName: string; line1: string; city: string; region?: string; phone: string; isDefault: boolean; label?: string; digitalAddress?: string; countryCode?: string }
