import { useQuery } from "@tanstack/react-query"
import { getHealth, getOrder, getSeller, getShopStats, getStatement, getTasks, listOrders, listDeals, listReturns, listThreads } from "./api"

export const qk = {
  seller: ["seller"] as const,
  tasks: ["tasks"] as const,
  health: ["health"] as const,
  orders: ["orders"] as const,
  order: (id: string) => ["orders", id] as const,
  statement: ["statement"] as const,
  shopStats: ["shop-stats"] as const,
  returns: ["returns"] as const,
  messages: ["messages"] as const,
}

export const useSeller = () => useQuery({ queryKey: qk.seller, queryFn: getSeller, staleTime: 60_000 })
export const useTasks = () => useQuery({ queryKey: qk.tasks, queryFn: getTasks, staleTime: 30_000 })
export const useHealth = () => useQuery({ queryKey: qk.health, queryFn: getHealth, staleTime: 60_000 })
export const useOrders = () => useQuery({ queryKey: qk.orders, queryFn: () => listOrders(), staleTime: 30_000 })
export const useOrder = (id: string) => useQuery({ queryKey: qk.order(id), queryFn: () => getOrder(id) })
export const useStatement = () => useQuery({ queryKey: qk.statement, queryFn: getStatement, staleTime: 60_000 })
export const useShopStats = () => useQuery({ queryKey: qk.shopStats, queryFn: getShopStats, staleTime: 300_000 })

/** Orders waiting to be packed — drives the Orders badge. */
export function useToPackCount() {
  const q = useOrders()
  return q.data ? q.data.items.filter((o) => o.status === "placed").length : 0
}

export const useReturns = () => useQuery({ queryKey: qk.returns, queryFn: listReturns, staleTime: 30_000 })
/** Inbox: unread chats + unanswered questions drive the header badge. */
export const useInbox = () => useQuery({ queryKey: qk.messages, queryFn: listThreads, staleTime: 20_000, refetchInterval: 60_000 })
/** Buyers' price offers; pending ones wait on the seller. */
export const useDeals = () => useQuery({ queryKey: ["deals"], queryFn: listDeals, staleTime: 20_000, refetchInterval: 60_000 })
