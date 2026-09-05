import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  loginAndSelectSeller,
  setActiveSellerId,
  getActiveSellerId,
  seller as sellerApi,
  auth as authApi,
  ApiError,
  type AlkemartMe,
} from "./api"

export function useCurrentUser() {
  return useQuery({
    queryKey: ["seller", "me"],
    queryFn: async (): Promise<AlkemartMe> => {
      // Use the bootstrap endpoint (no x-seller-id required) for auth check
      const data = await sellerApi.memberMe()
      // Restore seller_id into memory if we have it but module reloaded
      if (data.seller_id && !getActiveSellerId()) {
        setActiveSellerId(data.seller_id)
      }
      return data
    },
    staleTime: 30_000,
    retry: false,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return loginAndSelectSeller(email, password)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seller", "me"] })
      qc.invalidateQueries({ queryKey: ["vendor"] })
    },
    onError: (err: unknown) => {
      // Clear any stale seller context on auth failure
      if (err instanceof ApiError && err.status === 401) {
        setActiveSellerId(null)
      }
    },
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { email: string; password: string; first_name: string; last_name: string }) => {
      const sellerName = `${payload.first_name} ${payload.last_name}`.trim() || "New Shop"
      const sellerHandle = sellerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || `shop-${Date.now()}`
      const data = await authApi.registerSeller({
        email: payload.email,
        password: payload.password,
        sellerName,
        sellerHandle,
      })
      const sellerId = data.user?.sellerId ?? null
      if (sellerId) setActiveSellerId(sellerId)
      return { seller: { id: sellerId, name: sellerName, handle: sellerHandle } }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seller", "me"] })
    }
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await authApi.logout()
      setActiveSellerId(null)
    },
    onSuccess: () => qc.clear(),
  })
}
