import { useMemo } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"
import {
  useGetMe,
  getGetMeQueryKey,
  type AlkemartUser,
} from "./hooks-auth"
import { createMedusaClient } from "./medusa/client"
import {
  defaultBuyerRoles,
  defineAbilitiesFor,
  normalizeAuthUserRoles,
  type AppAbility,
  type AuthUserRole,
} from "@workspace/abilities"

/**
 * Shared session + authorization hook. Authorization decisions (what a user
 * can/cannot do, including vendor scoping) go through the CASL `ability`
 * returned here — the same model used server-side — rather than ad hoc role
 * string comparisons, so client and server never diverge on "who can do what".
 *
 * Roles come from GET /store/alkemart/me (server DB). UI ability is for
 * presentation only — privileged APIs must still 403 on the server.
 */
export function useAuth() {
  const { data, isLoading } = useGetMe()
  const user: AlkemartUser | null | undefined = data?.user
  const ability: AppAbility = useMemo(
    () => defineAbilitiesFor(normalizeAuthUserRoles(user?.roles)),
    [user],
  )
  return {
    user,
    ability,
    isLoading,
    isAuthenticated: Boolean(user),
  }
}

function buildAbility(user: AlkemartUser | null | undefined): AppAbility {
  return defineAbilitiesFor(normalizeAuthUserRoles(user?.roles))
}

/**
 * Use in a route's `beforeLoad` to require an active session, redirecting to
 * `/signin` (with a `redirect` search param back to the attempted page) if
 * there is none.
 */
export async function requireAuthBeforeLoad({
  context,
  location,
}: {
  context: { queryClient: QueryClient }
  location: { href: string }
}) {
  const session = await context.queryClient.ensureQueryData({
    queryKey: getGetMeQueryKey(),
    queryFn: async () => {
      try {
        const sdk = createMedusaClient()
        const token = await sdk.client.getToken()
        if (!token) return { user: null }

        const base =
          (import.meta.env.VITE_MEDUSA_BACKEND_URL as string | undefined)?.replace(
            /\/$/,
            "",
          ) || "http://localhost:9000"
        const pk = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY as string

        const res = await fetch(`${base}/store/alkemart/me`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "x-publishable-api-key": pk,
          },
        })
        if (res.status === 401) return { user: null }
        if (res.ok) {
          const data = (await res.json()) as {
            user?: AlkemartUser & { roles?: AuthUserRole[] }
          }
          if (data.user?.id) {
            return {
              user: {
                ...data.user,
                roles: normalizeAuthUserRoles(data.user.roles),
              },
            }
          }
        }

        // Fallback: bare customer (pre-RBAC deploy)
        const { customer } = await sdk.store.customer.retrieve()
        const meta = (customer as { metadata?: Record<string, unknown> }).metadata
        return {
          user: {
            id: customer.id,
            email: customer.email,
            firstName: (customer as { first_name?: string }).first_name,
            lastName: (customer as { last_name?: string }).last_name,
            roles: defaultBuyerRoles(),
            countryCode: (meta?.country_code as string) ?? "GH",
            preferredCurrency: (meta?.preferred_currency as string) ?? "GHS",
          },
        }
      } catch {
        return { user: null }
      }
    },
  })
  if (!session.user) {
    throw redirect({ to: "/signin", search: { redirect: location.href } })
  }
  return session.user
}

export { getGetMeQueryKey }
