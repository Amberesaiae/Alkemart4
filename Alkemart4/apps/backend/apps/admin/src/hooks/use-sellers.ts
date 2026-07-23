import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sellerQueue } from "../lib/api"

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
    },
  })

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => sellerQueue.suspend(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sellers-queue"] })
    },
  })

  return {
    pending: query.data?.pending || [],
    rejected: query.data?.rejected_applications || [],
    isLoading: query.isLoading,
    approve: approve.mutateAsync,
    isApproving: approve.isPending,
    suspend: suspend.mutateAsync,
    isSuspending: suspend.isPending,
  }
}
