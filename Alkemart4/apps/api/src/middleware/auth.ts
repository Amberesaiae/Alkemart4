import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../context"
import { verifySessionJwt } from "../lib/jwt"
import { validateWorkosClaims } from "../lib/workos-session"

function bearerToken(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token, extra] = header.split(" ")
  if (!scheme || !token || extra || scheme.toLowerCase() !== "bearer") return null
  return token
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = bearerToken(c.req.header("Authorization"))
  if (!token) throw new HTTPException(401, { message: "unauthorized" })
  const secret = c.get("jwtSecret")
  if (!secret) throw new HTTPException(500, { message: "internal_error" })
  try {
    c.set("auth", await verifySessionJwt(token, secret))
    await validateWorkosClaims(c, c.get("auth"))
  } catch {
    throw new HTTPException(401, { message: "unauthorized" })
  }
  await next()
}

/**
 * requireAuth + the session must post-date the account's last password
 * change, so a reset or change really signs every older device out.
 * One user read per request; used on buyer account routes.
 */
export const requireFreshSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  await requireAuth(c, async () => {
    const auth = c.get("auth")
    const user = await c.get("authRepo").findUserById(auth.userId)
    const dualBuyer = auth.sid && auth.role === "buyer" && user?.role === "seller_member"
    if (!user || (user.role !== auth.role && !dualBuyer)) throw new HTTPException(401, { message: "unauthorized" })
    const changed = user.passwordChangedAt?.getTime()
    if ((auth.pwd !== undefined && auth.pwd !== (changed ?? 0)) ||
      (changed && auth.pwd === undefined && (auth.iat === undefined || auth.iat <= Math.floor(changed / 1000)))) {
      throw new HTTPException(401, { message: "session_expired" })
    }
    await next()
  })
}

export const requireSeller: MiddlewareHandler<AppEnv> = async (c, next) => {
  await requireFreshSession(c, async () => {
    const auth = c.get("auth")
    if (auth.role !== "seller_member" || !auth.sellerId) {
      throw new HTTPException(403, { message: "forbidden" })
    }
    const member = await c.get("authRepo").findSellerMemberByUserId(auth.userId)
    if (!member || member.sellerId !== auth.sellerId) throw new HTTPException(403, { message: "forbidden" })
    if (member.role !== "owner") {
      const resource = c.req.path.split("/")[2]
      // Pilot staff can operate catalog and fulfillment, but cannot change
      // shop identity, policy, payout details, financial decisions or onboarding.
      const staffWrites = new Set(["products", "catalogue", "collections", "imports", "orders", "reviews", "messages", "uploads", "videos", "preferences"])
      const readOnly = c.req.method === "GET" || c.req.method === "HEAD"
      if (["payouts", "business", "onboarding", "sellers"].includes(resource ?? "")
        || (!readOnly && !staffWrites.has(resource ?? ""))) {
        throw new HTTPException(403, { message: "seller_owner_required" })
      }
    }
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const seller = await c.get("authRepo").findSellerById(auth.sellerId)
      if (!seller || seller.status === "suspended" || seller.status === "terminated") {
        throw new HTTPException(403, { message: "seller_account_restricted" })
      }
    }
    await next()
  })
}

/** A verified buyer is required for purchase and private order operations. */
export const requireVerifiedBuyer: MiddlewareHandler<AppEnv> = async (c, next) => {
  await requireFreshSession(c, async () => {
    const auth = c.get("auth")
    if (auth.role !== "buyer") throw new HTTPException(403, { message: "forbidden" })
    const user = await c.get("authRepo").findUserById(auth.userId)
    if (!user?.emailVerifiedAt) throw new HTTPException(403, { message: "email_verification_required" })
    await next()
  })
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  await requireFreshSession(c, async () => {
    const auth = c.get("auth")
    if (auth.role !== "admin") {
      throw new HTTPException(403, { message: "forbidden" })
    }
    await next()
  })
}
