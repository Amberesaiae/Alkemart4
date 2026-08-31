import { hashPassword, verifyPassword } from "@alkemart/domain"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { AuthConflictError, type AuthUser, type UserRole } from "../auth-repository"
import type { AppEnv } from "../context"
import { signSessionJwt } from "./jwt"

export const Credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const VendorRegister = Credentials.extend({
  sellerName: z.string().trim().min(1).max(80),
  sellerHandle: z.string().trim().min(2).max(40),
})

const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
  if (sellerId) return { id: user.id, email: user.email, role: user.role, sellerId }
  return { id: user.id, email: user.email, role: user.role }
}

export async function issueSession(c: Context<AppEnv>, user: AuthUser, sellerId?: string) {
  const token = await signSessionJwt(
    { userId: user.id, role: user.role, ...(sellerId ? { sellerId } : {}) },
    c.get("jwtSecret"),
  )
  return { token, user: publicUser(user, sellerId) }
}

export async function loginAs(c: Context<AppEnv>, expectedRole: UserRole) {
  const parsed = Credentials.safeParse(await readJsonBody(c))
  if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
  const email = normalizeEmail(parsed.data.email)
  const user = await c.get("authRepo").findUserByEmail(email)
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    throw new HTTPException(401, { message: "invalid credentials" })
  }
  if (user.role !== expectedRole) {
    throw new HTTPException(401, { message: "invalid credentials" })
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
  const parsed = Credentials.safeParse(await readJsonBody(c))
  if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
  const email = normalizeEmail(parsed.data.email)
  try {
    const user = await c.get("authRepo").createUser({
      id: crypto.randomUUID(),
      email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "buyer",
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
  const parsed = VendorRegister.safeParse(await readJsonBody(c))
  if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
  const email = normalizeEmail(parsed.data.email)
  const sellerHandle = normalizeHandle(parsed.data.sellerHandle)
  if (!HANDLE_RE.test(sellerHandle)) throw new HTTPException(400, { message: "invalid body" })
  try {
    const created = await c.get("authRepo").registerVendor({
      user: {
        id: crypto.randomUUID(),
        email,
        passwordHash: await hashPassword(parsed.data.password),
      },
      seller: {
        id: crypto.randomUUID(),
        handle: sellerHandle,
        name: parsed.data.sellerName,
      },
    })
    return c.json(await issueSession(c, created.user, created.seller.id), 201)
  } catch (err) {
    if (err instanceof AuthConflictError) {
      throw new HTTPException(409, { message: `${err.field} already exists` })
    }
    throw err
  }
}
