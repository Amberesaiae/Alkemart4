import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sellerQueue } from "../lib/api"
import { toast } from "sonner"

export function useSellers() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["sellers-queue"],
    queryFn: sellerQueue.list,
  })

  const approve = useMutation({
    mutationFn: sellerQueue.approve,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sellers-queue"] })
      toast.success("Seller approved")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to approve seller")
    },
  })

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => sellerQueue.suspend(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sellers-queue"] })
      toast.success("Seller suspended")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to suspend seller")
    },
  })

  return {
    pending: query.data?.pending || [],
    rejected: query.data?.rejected_applications || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    approve: approve.mutateAsync,
    isApproving: approve.isPending,
    suspend: suspend.mutateAsync,
    isSuspending: suspend.isPending,
  }
}
