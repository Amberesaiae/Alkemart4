import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  defaultBuyerRoles,
  normalizeAuthUserRoles,
  type AuthUserRole,
} from "@workspace/abilities"
import { useMedusa } from "./medusa-provider"
import { requiredEnv } from "./medusa/client"

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
  /** CASL role assignments — always { role, vendorId }[] */
  roles: AuthUserRole[]
  countryCode?: string
  preferredCurrency?: string
}

function medusaCustomerToUser(
  c: MedusaCustomer,
  roles?: AuthUserRole[],
): AlkemartUser {
  const meta = c.metadata ?? {}
  return {
    id: c.id,
    email: c.email,
    firstName: c.first_name,
    lastName: c.last_name,
    phone: c.phone,
    roles: roles ?? normalizeAuthUserRoles(meta.roles),
    countryCode: (meta.country_code as string) ?? "GH",
    preferredCurrency: (meta.preferred_currency as string) ?? "GHS",
  }
}

function resolveBackendUrl(): string {
  try {
    return requiredEnv("VITE_MEDUSA_BACKEND_URL").replace(/\/$/, "")
  } catch {
    if (import.meta.env.PROD !== true) return "http://localhost:9000"
    throw new Error("Missing VITE_MEDUSA_BACKEND_URL")
  }
}

/**
 * Server-truth session: GET /store/alkemart/me (RBAC roles from DB).
 * Falls back to customer.retrieve + default buyer if endpoint unavailable.
 */
async function fetchAlkemartMe(
  sdk: ReturnType<typeof useMedusa>,
): Promise<{ user: AlkemartUser } | { user: null }> {
  const baseUrl = resolveBackendUrl()
  const publishableKey = requiredEnv("VITE_MEDUSA_PUBLISHABLE_KEY")
  const token = await sdk.client.getToken()
  if (!token) {
    return { user: null }
  }

  try {
    const res = await fetch(`${baseUrl}/store/alkemart/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-publishable-api-key": publishableKey,
        Authorization: `Bearer ${token}`,
      },
      credentials: "omit",
    })
    if (res.status === 401) {
      return { user: null }
    }
    if (res.ok) {
      const data = (await res.json()) as {
        user?: AlkemartUser
        roles?: AuthUserRole[]
        customer?: MedusaCustomer
      }
      if (data.user?.id) {
        return {
          user: {
            ...data.user,
            roles: normalizeAuthUserRoles(data.user.roles ?? data.roles),
          },
        }
      }
      if (data.customer) {
        return {
          user: medusaCustomerToUser(
            data.customer,
            normalizeAuthUserRoles(data.roles),
          ),
        }
      }
    }
  } catch {
    // Fall through to SDK retrieve
  }

  try {
    const { customer } = await sdk.store.customer.retrieve()
    return {
      user: medusaCustomerToUser(
        customer as MedusaCustomer,
        defaultBuyerRoles(),
      ),
    }
  } catch {
    return { user: null }
  }
}

export function useGetMe() {
  const sdk = useMedusa()

  return useQuery({
    queryKey: ["medusa", "me"],
    queryFn: async () => fetchAlkemartMe(sdk),
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

      const me = await fetchAlkemartMe(sdk)
      if (!me.user) {
        throw new Error("Login succeeded but session could not be loaded")
      }

      // Link guest cart so subsequent orders attach to this customer.
      try {
        const cartId = localStorage.getItem("alkemart:cart_id")
        if (cartId) {
          const transfer = (
            sdk.store.cart as { transferCart?: (id: string) => Promise<unknown> }
          ).transferCart
          if (typeof transfer === "function") {
            await transfer.call(sdk.store.cart, cartId)
          }
        }
      } catch {
        /* non-fatal */
      }

      return me.user
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "me"] })
      queryClient.invalidateQueries({ queryKey: ["medusa", "cart"] })
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
      // Medusa v2: register identity → create customer with registration JWT
      // (login alone fails for new emails; create without token returns 401)
      await sdk.auth.register("customer", "emailpass", {
        email: params.email,
        password: params.password,
      })

      const { customer } = await sdk.store.customer.create({
        first_name: params.firstName,
        last_name: params.lastName,
        email: params.email,
        phone: params.phone,
        metadata: {
          ...(params.phone ? { phone: params.phone } : {}),
          ...(params.countryCode ? { country_code: params.countryCode } : {}),
          ...(params.preferredCurrency
            ? { preferred_currency: params.preferredCurrency }
            : {}),
          ...(params.locale ? { locale: params.locale } : {}),
        },
      })

      // Exchange registration token for a normal session JWT
      await sdk.auth.login("customer", "emailpass", {
        email: params.email,
        password: params.password,
      })

      try {
        const cartId = localStorage.getItem("alkemart:cart_id")
        if (cartId) {
          const transfer = (
            sdk.store.cart as { transferCart?: (id: string) => Promise<unknown> }
          ).transferCart
          if (typeof transfer === "function") {
            await transfer.call(sdk.store.cart, cartId)
          }
        }
      } catch {
        /* non-fatal */
      }

      const me = await fetchAlkemartMe(sdk)
      if (me.user) return me.user
      return medusaCustomerToUser(customer as MedusaCustomer, defaultBuyerRoles())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "me"] })
      queryClient.invalidateQueries({ queryKey: ["medusa", "cart"] })
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
      // SDK jwtTokenStorageMethod=local uses this key — always clear it so
      // requireAuthBeforeLoad / useGetMe cannot revive a dead session.
      try {
        localStorage.removeItem("medusa_auth_token")
        localStorage.removeItem("alkemart:auth_token")
      } catch {
        /* ignore SSR / private mode */
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
      const me = await fetchAlkemartMe(sdk)
      if (me.user) {
        return {
          ...me.user,
          firstName: params.firstName ?? me.user.firstName,
          lastName: params.lastName ?? me.user.lastName,
        }
      }
      return medusaCustomerToUser(updated as MedusaCustomer, defaultBuyerRoles())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "me"] })
    },
  })
}

export const getGetMeQueryKey = () => ["medusa", "me"] as const
