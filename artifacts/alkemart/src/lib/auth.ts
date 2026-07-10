import { useMemo } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { useGetMe, getGetMeQueryOptions, getGetMeQueryKey } from "@workspace/api-client-react";
import type { AuthUser } from "@workspace/api-client-react";
import { defineAbilitiesFor, type AppAbility, type AuthUserRole } from "@workspace/abilities";

/**
 * Shared session + authorization hook. Authorization decisions (what a user
 * can/cannot do, including vendor scoping) go through the CASL `ability`
 * returned here — the same model used server-side — rather than ad hoc role
 * string comparisons, so client and server never diverge on "who can do what".
 */
export function useAuth() {
  const { data, isLoading } = useGetMe();
  const user: AuthUser | null | undefined = data?.user;
  const ability: AppAbility = useMemo(
    () => defineAbilitiesFor((user?.roles ?? []) as AuthUserRole[]),
    [user],
  );
  return {
    user,
    ability,
    isLoading,
    isAuthenticated: Boolean(user),
  };
}

function buildAbility(user: AuthUser | null | undefined): AppAbility {
  return defineAbilitiesFor((user?.roles ?? []) as AuthUserRole[]);
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
  context: { queryClient: QueryClient };
  location: { href: string };
}) {
  const session = await context.queryClient.ensureQueryData(getGetMeQueryOptions());
  if (!session.user) {
    throw redirect({ to: "/signin", search: { redirect: location.href } });
  }
  return session.user;
}

/**
 * Use in a `/vendor/*` route's `beforeLoad` once vendor-facing pages exist.
 * Requires an active session AND a CASL ability to update at least one
 * `Product` (i.e. a `vendor_owner`/`vendor_staff` role assignment) — a
 * capability buyers never have, unlike the broader `read Order` ability
 * that buyers and vendors share. Does NOT grant admin/support access.
 */
export async function requireVendorAccessBeforeLoad({
  context,
  location,
}: {
  context: { queryClient: QueryClient };
  location: { href: string };
}) {
  const user = await requireAuthBeforeLoad({ context, location });
  const ability = buildAbility(user);
  if (!ability.can("update", "Product")) {
    throw redirect({ to: "/signin", search: { redirect: location.href } });
  }
  return user;
}

/**
 * Use in an `/admin/*` route's `beforeLoad` once admin-facing pages exist.
 * Requires an active session AND the CASL `admin` capability
 * (`manage all`) rather than a plain role-string check.
 */
export async function requireAdminAccessBeforeLoad({
  context,
  location,
}: {
  context: { queryClient: QueryClient };
  location: { href: string };
}) {
  const user = await requireAuthBeforeLoad({ context, location });
  const ability = buildAbility(user);
  if (!ability.can("manage", "AdminPanel")) {
    throw redirect({ to: "/signin", search: { redirect: location.href } });
  }
  return user;
}

export { getGetMeQueryKey };
