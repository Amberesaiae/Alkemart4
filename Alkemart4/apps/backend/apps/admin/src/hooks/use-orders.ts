import { useQuery } from "@tanstack/react-query"
import { adminOrders } from "../lib/api"

export function useOrders(params?: { status?: string; limit?: number; offset?: number }) {
  const query = useQuery({
    queryKey: ["orders", params],
    queryFn: () => adminOrders.list(params),
  })
  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}
