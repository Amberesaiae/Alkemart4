import type { Request, Response, NextFunction } from "express";
import { defineAbilitiesFor, type AppAbility, type Actions, type Subjects } from "@workspace/abilities";
import { getSessionTokenFromRequest, loadUserFromSessionToken, type AuthenticatedUser } from "../lib/auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      ability: AppAbility;
    }
  }
}

/**
 * Loads the current user (if any) from the session cookie and attaches
 * `req.user` + `req.ability`. Never rejects — routes decide whether auth is
 * required via `requireAuth`/`requireAbility`.
 */
export async function authSessionMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = getSessionTokenFromRequest(req);
  if (token) {
    const user = await loadUserFromSessionToken(token);
    if (user) {
      req.user = user;
    }
  }
  req.ability = defineAbilitiesFor(req.user?.roles ?? []);
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

/**
 * Route guard that enforces authorization through the shared CASL ability
 * model (`req.ability`, built from the user's roles by `authSessionMiddleware`)
 * rather than ad hoc role-string checks. Use for any route that should be
 * restricted to a CASL capability, e.g. `requireAbility("manage", "Vendor")`
 * for vendor-owner-only routes or `requireAbility("manage", "AdminPanel")`
 * for admin-only routes.
 */
export function requireAbility(action: Actions, subject: Subjects) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!req.ability.can(action, subject)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
