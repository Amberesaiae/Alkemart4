import type { Request } from "express";
import { vendorIdsFor, isAdmin } from "@workspace/abilities";

/**
 * Centralized authorization helpers for vendor isolation (B.7).
 * These enforce row-level access rules that CASL's coarse-grained
 * checks cannot cover. Every vendor-scoped route must use these.
 */

/**
 * Assert the current user has access to a specific vendor.
 * Admins bypass; vendor_owner/staff must have a matching vendorId.
 */
export function assertVendorAccess(req: Request, vendorId: number): void {
  if (isAdmin(req.user!.roles)) return;
  const ids = vendorIdsFor(req.user!.roles);
  if (!ids.includes(vendorId)) {
    throw new ForbiddenError("You do not have access to this vendor");
  }
}

/**
 * Returns the vendor IDs the current user has access to.
 * Empty array for non-vendor roles (admin gets [] — use isAdmin instead).
 */
export function requireVendorScope(req: Request): Array<string | number> {
  return vendorIdsFor(req.user!.roles);
}

/**
 * Assert the current user can access an order.
 * Allowed: buyer who owns the order, vendor-on-order, admin, or support.
 */
export function assertOrderAccess(
  req: Request,
  order: { buyerUserId: number; vendorIds?: number[] },
): void {
  if (isAdmin(req.user!.roles)) return;
  if (req.ability.can("read", "AdminPanel")) return; // support_agent
  if (order.buyerUserId === req.user!.id) return;
  if (order.vendorIds) {
    const userVendorIds = vendorIdsFor(req.user!.roles);
    if (order.vendorIds.some((id) => userVendorIds.includes(id))) return;
  }
  throw new ForbiddenError("You do not have access to this order");
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
