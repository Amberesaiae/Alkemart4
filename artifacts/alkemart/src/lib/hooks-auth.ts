import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMedusa } from "./medusa-provider"

export type MedusaCustomer = {
  id: string
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export type AlkemartUser = {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  roles?: string[]
  countryCode?: string
  preferredCurrency?: string
}

function medusaCustomerToUser(c: MedusaCustomer): AlkemartUser {
  // Prefer admin-set roles on customer.metadata; unmigrated customers default to buyer only.
  const rolesFromMeta = Array.isArray(c.metadata?.roles)
    ? (c.metadata!.roles as unknown[]).filter((r): r is string => typeof r === "string")
    : null
  return {
    id: c.id,
    email: c.email,
    firstName: c.first_name,
    lastName: c.last_name,
    phone: c.phone,
    roles: rolesFromMeta ?? ["buyer"],
    countryCode: (c.metadata?.country_code as string) ?? "GH",
    preferredCurrency: (c.metadata?.preferred_currency as string) ?? "GHS",
  }
}

export function useGetMe() {
  const sdk = useMedusa()

  return useQuery({
    queryKey: ["medusa", "me"],
    queryFn: async () => {
      try {
        const { customer } = await sdk.store.customer.retrieve()
        return { user: medusaCustomerToUser(customer as MedusaCustomer) }
      } catch {
        return { user: null }
      }
    },
    retry: false,
    throwOnError: false,
    staleTime: 300000,
  })
}

export function useLogin() {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { email: string; password: string }) => {
      const result = await sdk.auth.login("customer", "emailpass", {
        email: params.email,
        password: params.password,
      })

      if (typeof result !== "string") {
        throw new Error("Authentication requires additional steps")
      }

      const { customer } = await sdk.store.customer.retrieve()
      return medusaCustomerToUser(customer as MedusaCustomer)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "me"] })
    },
  })
}

export function useSignup() {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      email: string
      password: string
      firstName?: string
      lastName?: string
      phone?: string
      countryCode?: string
      preferredCurrency?: string
      locale?: string
    }) => {
      // First try to get auth token (register flow in Medusa v2)
      try {
        await sdk.auth.login("customer", "emailpass", {
          email: params.email,
          password: params.password,
        })
      } catch {
        // Expected if customer doesn't exist yet
      }

      const { customer } = await sdk.store.customer.create({
        first_name: params.firstName,
        last_name: params.lastName,
        email: params.email,
      })

      // Store extra metadata
      if (params.phone || params.countryCode || params.preferredCurrency) {
        try {
          await sdk.store.customer.update(customer.id, {
            metadata: {
              phone: params.phone,
              country_code: params.countryCode,
              preferred_currency: params.preferredCurrency,
            },
          } as any)
        } catch {
          // Metadata update is non-critical
        }
      }

      // Login after registration
      await sdk.auth.login("customer", "emailpass", {
        email: params.email,
        password: params.password,
      })

      const { customer: fullCustomer } = await sdk.store.customer.retrieve()
      return medusaCustomerToUser(fullCustomer as MedusaCustomer)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "me"] })
    },
  })
}

export function useLogout() {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      try {
        await sdk.auth.logout()
      } catch {
        // Logout may fail if not authenticated, that's fine
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["medusa", "me"], { user: null })
      queryClient.invalidateQueries({ queryKey: ["medusa"] })
    },
  })
}

export function useUpdateMyProfile() {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      firstName?: string
      lastName?: string
      phone?: string
      metadata?: Record<string, unknown>
    }) => {
      const { customer } = await sdk.store.customer.retrieve()
      const { customer: updated } = await sdk.store.customer.update(customer.id, {
        first_name: params.firstName,
        last_name: params.lastName,
        metadata: params.metadata,
      } as any)
      return medusaCustomerToUser(updated as MedusaCustomer)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "me"] })
    },
  })
}

export const getGetMeQueryKey = () => ["medusa", "me"] as const
