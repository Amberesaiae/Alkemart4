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
      const data = await sellerApi.alkemartMe()
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
    mutationFn: async ({ email, password }: any) => {
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
    mutationFn: async (payload: any) => {
      await authApi.register(payload.email, payload.password)
      await loginAndSelectSeller(payload.email, payload.password)
      
      const sellerData = await sellerApi.create({
        email: payload.email,
        name: `${payload.first_name} ${payload.last_name}'s Shop`,
        first_name: payload.first_name,
        last_name: payload.last_name,
      })
      
      await sellerApi.select(sellerData.seller.id)
      setActiveSellerId(sellerData.seller.id)
      return sellerData
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
