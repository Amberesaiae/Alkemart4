import { useQuery } from "@tanstack/react-query"
import { apiJson } from "./http"

/** alkemart Buyer Protection numbers (admin return policy). */
export type Protection = { faultReturnDays: number; heldUntilDelivered: string[] }

export const getProtection = () => apiJson<Protection>("/store/protection")

/** Cached for the session; the numbers change rarely. */
export const useProtection = () => useQuery({ queryKey: ["store", "protection"], queryFn: getProtection, staleTime: 30 * 60_000, retry: false })
