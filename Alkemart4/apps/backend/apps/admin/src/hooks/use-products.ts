import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { moderation } from "../lib/api"

export function useProducts() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["products-queue"],
    queryFn: moderation.listProducts,
  })

  const confirm = useMutation({
    mutationFn: moderation.confirmProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-queue"] })
    },
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => moderation.rejectProduct(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-queue"] })
    },
  })

  const requestChanges = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => moderation.requestChanges(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-queue"] })
    },
  })

  return {
    products: query.data?.proposed || [],
    isLoading: query.isLoading,
    confirm: confirm.mutateAsync,
    isConfirming: confirm.isPending,
    reject: reject.mutateAsync,
    isRejecting: reject.isPending,
    requestChanges: requestChanges.mutateAsync,
    isRequestingChanges: requestChanges.isPending,
  }
}
