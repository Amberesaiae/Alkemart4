import { createRemoteJWKSet, jwtVerify } from "jose"
import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../context"

// One JWKS cache per Access team; jose refreshes keys on rotation.
type KeySet = ReturnType<typeof createRemoteJWKSet>
const keySets = new Map<string, KeySet>()
/** Test seam: pin a team's verification keys instead of fetching them. */
export function setAccessKeysForTest(team: string, keys: KeySet) { keySets.set(team, keys) }
function keysFor(team: string) {
  let keys = keySets.get(team)
  if (!keys) keySets.set(team, (keys = createRemoteJWKSet(new URL(`${team}/cdn-cgi/access/certs`))))
  return keys
}

/** Verify Cloudflare's signed proof, never a caller-controlled email header. */
export const requireAdminAccess: MiddlewareHandler<AppEnv> = async (c, next) => {
  const env = c.env
  if (env?.ENVIRONMENT !== "production") return next()
  const team = env.ADMIN_ACCESS_TEAM
  const audience = env.ADMIN_ACCESS_AUD
  const approved = new Set((env.ADMIN_ACCESS_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))
  // Fail closed: production without a configured Access boundary serves no admin API.
  if (!team || !audience || !approved.size) return c.json({ error: "access_not_configured" }, 503)
  const assertion = c.req.header("Cf-Access-Jwt-Assertion")
  if (!assertion) return c.json({ error: "access_required" }, 403)
  try {
    const { payload } = await jwtVerify(assertion, keysFor(team), {
      issuer: team,
      audience,
      algorithms: ["RS256"],
    })
    if (typeof payload.email !== "string" || !approved.has(payload.email.toLowerCase())) {
      return c.json({ error: "access_denied" }, 403)
    }
  } catch {
    return c.json({ error: "access_denied" }, 403)
  }
  await next()
}
