import { useQuery } from "@tanstack/react-query"
import { listReturns, type ReturnView } from "./returns"
import { listReported } from "./messages"
import { listPayable } from "./payouts"
import { getMe, getStats, getTraffic, listAppeals, listListings, listPendingReviews, listSellers, type AdminListing } from "./api"

export const qk = {
  me: ["me"] as const,
  stats: ["stats"] as const,
  traffic: ["traffic"] as const,
  sellers: ["sellers"] as const,
  listings: (status?: string) => ["listings", status ?? "all"] as const,
  appeals: ["appeals"] as const,
  reviews: ["reviews", "pending"] as const,
  returns: (view: ReturnView) => ["returns", view] as const,
}

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: getMe, staleTime: 300_000 })
export const useStats = () => useQuery({ queryKey: qk.stats, queryFn: getStats, staleTime: 60_000 })
export const useTraffic = () => useQuery({ queryKey: qk.traffic, queryFn: getTraffic, staleTime: 300_000 })
export const useSellers = () => useQuery({ queryKey: qk.sellers, queryFn: listSellers, staleTime: 30_000 })
/** A proposed listing sent back for changes is waiting on the seller, not on us. */
export const awaitsReview = (l: AdminListing) => l.status === "proposed" && l.review?.decision !== "request_changes"
export const useListingsToReview = () =>
  useQuery({
    queryKey: qk.listings("proposed"),
    queryFn: () => listListings("proposed"),
    select: (xs) => xs.filter(awaitsReview),
    staleTime: 30_000,
  })
export const useAppeals = () => useQuery({ queryKey: qk.appeals, queryFn: listAppeals, staleTime: 30_000 })
export const usePendingReviews = () => useQuery({ queryKey: qk.reviews, queryFn: listPendingReviews, staleTime: 30_000 })
/** Reported conversations waiting for a look (the nav badge). */
export const useReportedMessages = () => useQuery({ queryKey: ["reported-messages"], queryFn: listReported, staleTime: 30_000 })
/** Returns the buyer and seller couldn't settle (the nav badge). */
export const useReturnsToDecide = () => useQuery({ queryKey: qk.returns("decide"), queryFn: () => listReturns("decide"), staleTime: 30_000 })
/** Sellers with released money waiting (shares its cache with Payouts). */
export const usePayable = () => useQuery({ queryKey: ["payable"], queryFn: listPayable, staleTime: 20_000 })
