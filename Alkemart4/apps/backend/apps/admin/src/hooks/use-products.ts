import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { moderation } from "../lib/api"
import { toast } from "sonner"

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
      toast.success("Product confirmed")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to confirm product")
    },
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => moderation.rejectProduct(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-queue"] })
      toast.success("Product rejected")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to reject product")
    },
  })

  const requestChanges = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => moderation.requestChanges(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-queue"] })
      toast.success("Changes requested")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to request changes")
    },
  })

  return {
    products: query.data?.proposed || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    confirm: confirm.mutateAsync,
    isConfirming: confirm.isPending,
    reject: reject.mutateAsync,
    isRejecting: reject.isPending,
    requestChanges: requestChanges.mutateAsync,
    isRequestingChanges: requestChanges.isPending,
  }
}
