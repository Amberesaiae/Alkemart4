import { AbilityBuilder, createMongoAbility, type MongoAbility, type MongoQuery } from "@casl/ability";

export const ROLES = ["buyer", "vendor_owner", "vendor_staff", "admin", "support_agent"] as const;
export type Role = (typeof ROLES)[number];

export type Actions = "manage" | "read" | "create" | "update" | "delete";
export type Subjects =
  | "Product"
  | "Vendor"
  | "Order"
  | "User"
  | "Dispute"
  | "Payout"
  | "AdminPanel"
  | "HomepageConfig"
  | "Conversation"
  | "Image"
  | "Promotion"
  | "Fulfillment"
  | "all";

export type AppAbility = MongoAbility<[Actions, Subjects], MongoQuery>;

export interface AuthUserRole {
  role: Role;
  vendorId: number | null;
}

/**
 * Builds a CASL ability instance from a user's role assignments. Shared between
 * the API server (route guards) and the frontend (conditional UI rendering).
 *
 * This is a coarse-grained, role-level foundation: conditions scope by vendorId
 * where relevant, but callers must still enforce row-level ownership in route
 * handlers (e.g. `WHERE vendor_id = :vendorId`) — CASL here governs "can this
 * kind of action ever be attempted", not a substitute for query-level scoping.
 */
export function defineAbilitiesFor(roles: AuthUserRole[]): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  // CASL's TS overloads only type conditions when a subject-shape map is supplied
  // to MongoAbility; this foundation lib intentionally keeps subjects as plain
  // string tags (no per-subject field map), so conditions are typed loosely here.
  const canWith = can as (action: Actions | Actions[], subject: Subjects, conditions?: Record<string, unknown>) => void;

  // Vendor scope must be computed PER ROLE, not pooled across all role
  // assignments — otherwise a user with e.g. vendor_owner on vendor B and
  // vendor_staff on vendor A would bleed owner-level rules onto vendor A too.
  const vendorIdsForRole = (targetRole: Role): number[] =>
    roles
      .filter((r): r is AuthUserRole & { vendorId: number } => r.role === targetRole && r.vendorId != null)
      .map((r) => r.vendorId);

  for (const { role } of roles) {
    switch (role) {
      case "buyer":
        can("read", "Product");
        can(["create", "read"], "Order");
        can(["create", "read"], "Conversation");
        break;
      case "vendor_owner": {
        const ownedVendorIds = vendorIdsForRole("vendor_owner");
        canWith("manage", "Product", { vendorId: { $in: ownedVendorIds } });
        canWith("manage", "Vendor", { id: { $in: ownedVendorIds } });
        canWith("read", "Order", { vendorId: { $in: ownedVendorIds } });
        canWith(["read", "update"], "Fulfillment", { vendorId: { $in: ownedVendorIds } });
        can(["create", "read"], "Conversation");
        canWith(["create", "read"], "Image", { vendorId: { $in: ownedVendorIds } });
        break;
      }
      case "vendor_staff": {
        const staffVendorIds = vendorIdsForRole("vendor_staff");
        canWith(["read", "update"], "Product", { vendorId: { $in: staffVendorIds } });
        canWith("read", "Order", { vendorId: { $in: staffVendorIds } });
        canWith(["read", "update"], "Fulfillment", { vendorId: { $in: staffVendorIds } });
        can(["create", "read"], "Conversation");
        canWith(["create", "read"], "Image", { vendorId: { $in: staffVendorIds } });
        break;
      }
      case "support_agent":
        can("read", "Order");
        can("manage", "Dispute");
        can("manage", "Conversation");
        // Support agents can view the admin shell (vendor list, dispute queue,
        // inbox, analytics) but cannot mutate admin-only resources such as
        // vendor status.  "read AdminPanel" gates GET routes; mutation routes
        // (PATCH /admin/vendors/:id) additionally check isAdmin() so support
        // agents are blocked even though they can enter the panel.
        can("read", "AdminPanel");
        break;
      case "admin":
        can("manage", "all");
        break;
    }
  }

  return build();
}

export function hasRole(roles: AuthUserRole[], role: Role, vendorId?: number): boolean {
  return roles.some((r) => r.role === role && (vendorId == null || r.vendorId === vendorId));
}

export function isVendor(roles: AuthUserRole[]): boolean {
  return roles.some((r) => r.role === "vendor_owner" || r.role === "vendor_staff");
}

export function isAdmin(roles: AuthUserRole[]): boolean {
  return roles.some((r) => r.role === "admin");
}

/**
 * Returns the unique vendor ids a user has ANY vendor role
 * (`vendor_owner` or `vendor_staff`) for. Use this server-side to scope a
 * "my vendor's data" list query (e.g. `WHERE vendor_id IN (...)`); it does
 * NOT distinguish owner vs staff privileges — for per-action authorization
 * (e.g. can this user edit vs. only view), check `defineAbilitiesFor(roles)`
 * with the actual subject instance instead.
 */
export function vendorIdsFor(roles: AuthUserRole[]): number[] {
  const ids = roles
    .filter((r) => (r.role === "vendor_owner" || r.role === "vendor_staff") && r.vendorId != null)
    .map((r) => r.vendorId as number);
  return Array.from(new Set(ids));
}

export { AbilityBuilder, createMongoAbility };
export type { MongoAbility };
