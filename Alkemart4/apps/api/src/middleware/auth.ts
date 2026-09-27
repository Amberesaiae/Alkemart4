import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../context"
import { verifySessionJwt } from "../lib/jwt"

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
    if (!user) throw new HTTPException(401, { message: "unauthorized" })
    const changed = user.passwordChangedAt?.getTime()
    if (changed && auth.iat != null && auth.iat * 1000 < changed - 1000) {
      throw new HTTPException(401, { message: "session_expired" })
    }
    await next()
  })
}

export const requireSeller: MiddlewareHandler<AppEnv> = async (c, next) => {
  await requireAuth(c, async () => {
    const auth = c.get("auth")
    if (auth.role !== "seller_member" || !auth.sellerId) {
      throw new HTTPException(403, { message: "forbidden" })
    }
    await next()
  })
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  await requireAuth(c, async () => {
    const auth = c.get("auth")
    if (auth.role !== "admin") {
      throw new HTTPException(403, { message: "forbidden" })
    }
    await next()
  })
}
