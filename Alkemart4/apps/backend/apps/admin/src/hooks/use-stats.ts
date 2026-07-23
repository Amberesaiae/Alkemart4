import { useQuery } from "@tanstack/react-query"
import { platformStats } from "../lib/api"

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: platformStats.get,
    refetchInterval: 60000,
  })
}
