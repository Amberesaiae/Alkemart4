import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminCatalogProducts, adminCategories, adminSellers } from "../lib/api"
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

/** Seller's catalog products + specialisations (top categories by product count). */
export function useAdminSellerProducts(sellerId: string) {
  const productsQ = useQuery({
    queryKey: ["admin-catalog-products"],
    queryFn: () => adminCatalogProducts.listAll(),
    staleTime: 60_000,
  })
  const catsQ = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminCategories.list(),
    staleTime: 300_000,
  })
  const all = productsQ.data?.items ?? []
  const mine = sellerId ? all.filter((p) => p.sellerId === sellerId) : []
  const catName = new Map((catsQ.data?.product_categories ?? []).map((c) => [c.id, c.name]))
  const byCat = new Map<string, number>()
  for (const p of mine) byCat.set(p.primaryCategoryId, (byCat.get(p.primaryCategoryId) ?? 0) + 1)
  const specialisations = [...byCat]
    .map(([id, count]) => ({ id, name: catName.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
  return {
    products: mine,
    specialisations,
    isLoading: productsQ.isLoading || catsQ.isLoading,
  }
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
