import { passwordHashNeedsUpgrade, verifyPassword } from "@alkemart/domain"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { AuthConflictError, type AuthUser, type UserRole } from "../auth-repository"
import type { AppEnv } from "../context"
import { signSessionJwt } from "./jwt"
import { limitAccountAttempts } from "./auth-rate-limit"
import { verifySignupChallenge } from "./turnstile"
import { hashPasswordForRequest, passwordWorkFactor } from "./password-policy"
import { sendEmailVerification } from "./email-verification"

export const Credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
})

export const VendorRegister = Credentials.extend({
  sellerName: z.string().trim().min(1).max(80),
  sellerHandle: z.string().trim().min(2).max(40),
})

const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const BuyerRegister = Credentials.extend({ turnstileToken: z.string().max(2048).optional() })
const ProtectedVendorRegister = VendorRegister.extend({ turnstileToken: z.string().max(2048).optional() })

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase()
}

export async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    throw new HTTPException(400, { message: "invalid body" })
  }
}

function publicUser(user: AuthUser, sellerId?: string) {
  if (sellerId) return { id: user.id, email: user.email, role: user.role, sellerId, emailVerified: Boolean(user.emailVerifiedAt) }
  return { id: user.id, email: user.email, role: user.role, emailVerified: Boolean(user.emailVerifiedAt) }
}

export async function issueSession(c: Context<AppEnv>, user: AuthUser, sellerId?: string) {
  const token = await signSessionJwt(
    { userId: user.id, role: user.role, pwd: user.passwordChangedAt?.getTime() ?? 0, ...(sellerId ? { sellerId } : {}) },
    c.get("jwtSecret"),
  )
  return { token, user: publicUser(user, sellerId) }
}

export async function loginAs(c: Context<AppEnv>, expectedRole: UserRole) {
  if (expectedRole !== "admin" && c.env?.WORKOS_ENABLED === "1") throw new HTTPException(409, { message: "use_workos_sign_in" })
  const parsed = Credentials.safeParse(await readJsonBody(c))
  if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
  const email = normalizeEmail(parsed.data.email)
  await limitAccountAttempts(c, expectedRole, email)
  let user = await c.get("authRepo").findUserByEmail(email)
  // Do comparable password work for unknown accounts rather than leak existence via timing.
  const dummyHash = `pbkdf2-sha256$100000$${"00".repeat(16)}$${"00".repeat(32)}`
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? dummyHash)
  if (!user || !valid) {
    throw new HTTPException(401, { message: "invalid credentials" })
  }
  if (user.role !== expectedRole) {
    throw new HTTPException(401, { message: "invalid credentials" })
  }
  if (passwordHashNeedsUpgrade(user.passwordHash, passwordWorkFactor(c))) {
    user = await c.get("authRepo").rehashUserPassword(user.id, user.passwordHash, await hashPasswordForRequest(c, parsed.data.password))
    if (!user) throw new HTTPException(401, { message: "invalid credentials" })
  }
  let sellerId: string | undefined
  if (expectedRole === "seller_member") {
    const member = await c.get("authRepo").findSellerMemberByUserId(user.id)
    if (!member) throw new HTTPException(401, { message: "invalid credentials" })
    sellerId = member.sellerId
  }
  return c.json(await issueSession(c, user, sellerId))
}

export async function registerBuyer(c: Context<AppEnv>) {
  if (c.env?.WORKOS_ENABLED === "1") throw new HTTPException(409, { message: "use_workos_sign_in" })
  const parsed = BuyerRegister.safeParse(await readJsonBody(c))
  if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
  await verifySignupChallenge(c, parsed.data.turnstileToken)
  const email = normalizeEmail(parsed.data.email)
  try {
    const user = await c.get("authRepo").createUser({
      id: crypto.randomUUID(),
      email,
      passwordHash: await hashPasswordForRequest(c, parsed.data.password),
      role: "buyer",
    })
    // Registration remains recoverable if the mail queue is unavailable;
    // checkout still fails closed until email ownership is verified.
    await sendEmailVerification(c, user, "storefront").catch(() => {
      console.error(JSON.stringify({ job: "email-verification-enqueue", userId: user.id, outcome: "failed" }))
    })
    return c.json(await issueSession(c, user), 201)
  } catch (err) {
    if (err instanceof AuthConflictError) {
      throw new HTTPException(409, { message: `${err.field} already exists` })
    }
    throw err
  }
}

export async function registerVendor(c: Context<AppEnv>) {
  if (c.env?.WORKOS_ENABLED === "1") throw new HTTPException(409, { message: "use_workos_sign_in" })
  const parsed = ProtectedVendorRegister.safeParse(await readJsonBody(c))
  if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
  await verifySignupChallenge(c, parsed.data.turnstileToken)
  const email = normalizeEmail(parsed.data.email)
  const sellerHandle = normalizeHandle(parsed.data.sellerHandle)
  if (!HANDLE_RE.test(sellerHandle)) throw new HTTPException(400, { message: "invalid body" })
  try {
    const created = await c.get("authRepo").registerVendor({
      user: {
        id: crypto.randomUUID(),
        email,
        passwordHash: await hashPasswordForRequest(c, parsed.data.password),
      },
      seller: {
        id: crypto.randomUUID(),
        handle: sellerHandle,
        name: parsed.data.sellerName,
      },
    })
    await sendEmailVerification(c, created.user, "vendor").catch(() => {
      console.error(JSON.stringify({ job: "email-verification-enqueue", userId: created.user.id, outcome: "failed" }))
    })
    return c.json(await issueSession(c, created.user, created.seller.id), 201)
  } catch (err) {
    if (err instanceof AuthConflictError) {
      throw new HTTPException(409, { message: `${err.field} already exists` })
    }
    throw err
  }
}
