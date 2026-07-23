import { createContext, useContext, useMemo, type ReactNode } from "react"
import type Medusa from "@medusajs/js-sdk"
import { createMedusaClient } from "./medusa/client"

const MedusaContext = createContext<Medusa | null>(null)

export function MedusaProvider({ children }: { children: ReactNode }) {
  const sdk = useMemo(() => createMedusaClient(), [])

  return <MedusaContext.Provider value={sdk}>{children}</MedusaContext.Provider>
}

export function useMedusa() {
  const sdk = useContext(MedusaContext)
  if (!sdk) {
    throw new Error("useMedusa must be used within a MedusaProvider")
  }
  return sdk
}
