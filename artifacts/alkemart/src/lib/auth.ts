import { useMemo } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"
import { useGetMe, getGetMeQueryKey, type AlkemartUser } from "./hooks-auth"
import { createMedusaClient } from "./medusa/client"
import { defineAbilitiesFor, type AppAbility, type AuthUserRole } from "@workspace/abilities"

/**
 * Shared session + authorization hook. Authorization decisions (what a user
 * can/cannot do, including vendor scoping) go through the CASL `ability`
 * returned here — the same model used server-side — rather than ad hoc role
 * string comparisons, so client and server never diverge on "who can do what".
 */
export function useAuth() {
  const { data, isLoading } = useGetMe()
  const user: AlkemartUser | null | undefined = data?.user
  const ability: AppAbility = useMemo(
    () => defineAbilitiesFor((user?.roles ?? []) as AuthUserRole[]),
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
  return defineAbilitiesFor((user?.roles ?? []) as AuthUserRole[])
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
        const { customer } = await sdk.store.customer.retrieve()
        const meta = (customer as { metadata?: Record<string, unknown> }).metadata
        // Prefer admin-set roles on customer.metadata; unmigrated customers default to buyer only.
        const rolesFromMeta = Array.isArray(meta?.roles)
          ? (meta!.roles as string[]).filter((r) => typeof r === "string")
          : null
        return {
          user: {
            id: customer.id,
            email: customer.email,
            firstName: (customer as { first_name?: string }).first_name,
            lastName: (customer as { last_name?: string }).last_name,
            roles: rolesFromMeta ?? ["buyer"],
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

/**
 * Use in a `/vendor/*` route's `beforeLoad` once vendor-facing pages exist.
 */
export async function requireVendorAccessBeforeLoad({
  context,
  location,
}: {
  context: { queryClient: QueryClient }
  location: { href: string }
}) {
  const user = await requireAuthBeforeLoad({ context, location })
  const ability = buildAbility(user)
  if (!ability.can("update", "Product")) {
    throw redirect({ to: "/signin", search: { redirect: location.href } })
  }
  return user
}

/**
 * Use in an `/admin/*` route's `beforeLoad`.
 */
export async function requireAdminAccessBeforeLoad({
  context,
  location,
}: {
  context: { queryClient: QueryClient }
  location: { href: string }
}) {
  const user = await requireAuthBeforeLoad({ context, location })
  const ability = buildAbility(user)
  const canEnter =
    ability.can("manage", "AdminPanel") || ability.can("read", "AdminPanel")
  if (!canEnter) {
    throw redirect({ to: "/" })
  }
  return user
}

/**
 * Full admin only (homepage, promotions, image mod, role admin).
 */
export async function requireFullAdminBeforeLoad({
  context,
  location,
}: {
  context: { queryClient: QueryClient }
  location: { href: string }
}) {
  const user = await requireAdminAccessBeforeLoad({ context, location })
  const ability = buildAbility(user)
  if (!ability.can("manage", "AdminPanel")) {
    throw redirect({ to: "/admin" })
  }
  return user
}

/** True if the user can open the admin shell (admin or support). */
export function canAccessAdminPanel(ability: AppAbility): boolean {
  return ability.can("manage", "AdminPanel") || ability.can("read", "AdminPanel")
}

/** True if the user can mutate admin-only resources (homepage, promos, roles). */
export function canManageAdminPanel(ability: AppAbility): boolean {
  return ability.can("manage", "AdminPanel")
}

export { getGetMeQueryKey }
