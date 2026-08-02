import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminReturns } from "../lib/api"
import { toast } from "sonner"

export function useAdminReturns(params?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["admin-returns", params],
    queryFn: () => adminReturns.list(params),
  })
}

export function useAdminReturnDetail(id: string) {
  return useQuery({
    queryKey: ["admin-return", id],
    queryFn: () => adminReturns.retrieve(id),
    enabled: !!id,
  })
}

export function useReturnActions() {
  const qc = useQueryClient()
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["admin-returns"] })
    if (id) qc.invalidateQueries({ queryKey: ["admin-return", id] })
  }

  const approve = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => adminReturns.approve(id, note),
    onSuccess: (_, { id }) => { invalidate(id); toast.success("Return approved") },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to approve"),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminReturns.reject(id, reason),
    onSuccess: (_, { id }) => { invalidate(id); toast.success("Return rejected") },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to reject"),
  })

  const refund = useMutation({
    mutationFn: (id: string) => adminReturns.refund(id),
    onSuccess: (_, id) => { invalidate(id); toast.success("Refund processed") },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to refund"),
  })

  return { approve, reject, refund }
}
