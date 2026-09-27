import { useQuery } from "@tanstack/react-query"
import { qk } from "./queries"
import { setupProgress } from "./setup"
import { getPolicy, getShop } from "./shop"

/** Shop settings + policy + how far setup is. Shared by Home, Shop and /setup. */
export function useSetup() {
  const shop = useQuery({ queryKey: [...qk.seller, "full"], queryFn: getShop, staleTime: 60_000 })
  const policy = useQuery({ queryKey: ["policy"], queryFn: getPolicy })
  const progress = shop.data && !policy.isPending ? setupProgress(shop.data, !!policy.data) : null
  return { shop, policy, progress }
}
