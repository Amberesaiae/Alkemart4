import { useQuery } from "@tanstack/react-query"
import { markets } from "../lib/api"

export function useMarkets() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: markets.list,
  })
}
