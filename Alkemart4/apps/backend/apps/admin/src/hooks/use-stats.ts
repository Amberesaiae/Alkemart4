import { useQuery } from "@tanstack/react-query"
import { platformStats } from "../lib/api"

export function useStats() {
  const query = useQuery({
    queryKey: ["stats"],
    queryFn: platformStats.get,
    refetchInterval: 60000,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    dataUpdatedAt: query.dataUpdatedAt,
  }
}
