import { createContext } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { qk } from "@/lib/queries"
import type { ShopSettings } from "@/lib/shop"

export const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Couldn't save. Try again.")

/** Save a section and put the fresh seller everywhere it's shown. */
export function useSave<T>(fn: (v: T) => Promise<ShopSettings>, done: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (s) => {
      qc.setQueryData([...qk.seller, "full"], s)
      void qc.invalidateQueries({ queryKey: qk.seller, exact: true })
      void qc.invalidateQueries({ queryKey: ["tasks"] })
      toast.success(done)
    },
    onError: (e) => toast.error(errText(e)),
  })
}

/** Set by the setup stepper: sections render bare and their save moves to the next step. */
export const FlowContext = createContext<{ next: () => void } | null>(null)

export const PROVIDER_LABEL: Record<string, string> = { mtn: "MTN MoMo", vodafone: "Telecel Cash", airteltigo: "AirtelTigo Money" }
