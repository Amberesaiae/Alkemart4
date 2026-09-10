import { useQuery } from "@tanstack/react-query"
import { platformStats, platformTraffic } from "../lib/api"

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

export function useTrafficStats() {
  const query = useQuery({
    queryKey: ["stats", "traffic"],
    queryFn: platformTraffic.get,
    refetchInterval: 60000,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  }
}
