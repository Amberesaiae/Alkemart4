import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminSellers } from "../lib/api"
import { toast } from "sonner"

export function useAdminSellersList(params?: { limit?: number; offset?: number; q?: string }) {
  return useQuery({
    queryKey: ["admin-sellers", params],
    queryFn: () => adminSellers.list(params),
  })
}

export function useAdminSellerDetail(id: string) {
  return useQuery({
    queryKey: ["admin-seller", id],
    queryFn: () => adminSellers.retrieve(id),
    enabled: !!id,
  })
}

export function useSellerActions(sellerId: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-seller", sellerId] })
    qc.invalidateQueries({ queryKey: ["admin-sellers"] })
    qc.invalidateQueries({ queryKey: ["sellers-queue"] })
  }

  const approve = useMutation({
    mutationFn: () => adminSellers.approve(sellerId),
    onSuccess: () => { invalidate(); toast.success("Seller approved") },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const suspend = useMutation({
    mutationFn: (reason: string) => adminSellers.suspend(sellerId, reason),
    onSuccess: () => { invalidate(); toast.success("Seller suspended") },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const unsuspend = useMutation({
    mutationFn: () => adminSellers.unsuspend(sellerId),
    onSuccess: () => { invalidate(); toast.success("Seller reinstated") },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const terminate = useMutation({
    mutationFn: (reason: string) => adminSellers.terminate(sellerId, reason),
    onSuccess: () => { invalidate(); toast.success("Seller terminated") },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const setCommission = useMutation({
    mutationFn: (bps: number) => adminSellers.setCommission(sellerId, bps),
    onSuccess: () => { invalidate(); toast.success("Commission rate updated") },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  return { approve, suspend, unsuspend, terminate, setCommission }
}
