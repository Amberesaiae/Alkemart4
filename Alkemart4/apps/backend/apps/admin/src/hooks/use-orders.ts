import { useQuery } from "@tanstack/react-query"
import { adminOrders } from "../lib/api"

export function useOrders(params?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => adminOrders.list(params),
  })
}
