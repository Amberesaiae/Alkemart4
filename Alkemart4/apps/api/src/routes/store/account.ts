import { Hono, type MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { hashPassword, verifyPassword } from "@alkemart/domain"
import { AddressLimitError, type Address } from "../../account-store"
import type { AppEnv } from "../../context"
import { encodeEmail } from "../../email"
import { passwordChangedEmail } from "../../lib/email-templates"
import { issueSession, readJsonBody } from "../../lib/session"
import { requireFreshSession } from "../../middleware/auth"

/**
 * Buyer account (0037): profile, password, address book.
 *
 * Sessions issued before the last password change are refused here, so a
 * reset or change really locks out an old device for everything that
 * touches the account.
 */
const requireBuyer: MiddlewareHandler<AppEnv> = async (c, next) => {
  await requireFreshSession(c, async () => {
    if (c.get("auth").role !== "buyer") throw new HTTPException(403, { message: "forbidden" })
    await next()
  })
}

const name = z.string().trim().min(1).max(80)
/** Any market: digits with optional + and spaces; the market config formats. */
const phone = z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")

const ProfileBody = z
  .object({ firstName: name.nullable(), lastName: name.nullable(), phone: phone.nullable() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

const PasswordBody = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(200) })

const AddressFields = z.object({
  label: z.string().trim().max(40).nullable().optional(),
  firstName: name,
  lastName: name,
  phone,
  address1: z.string().trim().min(3).max(200),
  address2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  province: z.string().trim().max(100).nullable().optional(),
  postalCode: z.string().trim().max(40).nullable().optional(),
  countryCode: z.string().trim().length(2).toLowerCase(),
  latitude: z.number().min(4).max(11.8).nullable().optional(),
  longitude: z.number().min(-3.8).max(1.8).nullable().optional(),
  isDefault: z.boolean().optional(),
})
const samePin = (a: { latitude?: number | null; longitude?: number | null }) => (a.latitude == null) === (a.longitude == null)
const AddressBody = AddressFields.refine(samePin, { message: "pin needs both coordinates" })
const AddressPatch = AddressFields.partial().refine(samePin, { message: "pin needs both coordinates" })

function publicAddress(a: Address) {
  return {
    id: a.id,
    label: a.label ?? null,
    firstName: a.firstName,
    lastName: a.lastName,
    phone: a.phone,
    address1: a.address1,
    address2: a.address2 ?? null,
    city: a.city,
    province: a.province ?? null,
    postalCode: a.postalCode ?? null,
    countryCode: a.countryCode,
    latitude: a.latitude ?? null,
    longitude: a.longitude ?? null,
    isDefault: a.isDefault,
    updatedAt: a.updatedAt.toISOString(),
  }
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body)
  if (!r.success) throw new HTTPException(400, { message: r.error.issues[0]?.message ?? "invalid body" })
  return r.data
}

export const storeAccount = new Hono<AppEnv>()
  .use("*", requireBuyer)
  .get("/", async (c) => {
    const u = (await c.get("authRepo").findUserById(c.get("auth").userId))!
    return c.json({
      account: {
        email: u.email,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        phone: u.phone ?? null,
        memberSince: u.createdAt.toISOString(),
      },
    })
  })
  .patch("/", async (c) => {
    const patch = parse(ProfileBody, await readJsonBody(c))
    const u = await c.get("authRepo").updateUserProfile(c.get("auth").userId, patch)
    return c.json({ account: { email: u.email, firstName: u.firstName ?? null, lastName: u.lastName ?? null, phone: u.phone ?? null } })
  })
  .post("/password", async (c) => {
    const body = parse(PasswordBody, await readJsonBody(c))
    const repo = c.get("authRepo")
    const user = (await repo.findUserById(c.get("auth").userId))!
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw new HTTPException(400, { message: "Your current password isn't right." })
    }
    const updated = await repo.updateUserPassword(user.id, await hashPassword(body.newPassword))
    await c
      .get("checkoutRepo")
      .enqueueNotification({
        key: `password-changed:${user.id}:${Date.now()}`,
        recipient: user.email,
        channel: "email",
        category: "transactional",
        body: encodeEmail(passwordChangedEmail()),
      })
      .catch(() => undefined)
    // Every older session is now stale; hand this device a fresh one.
    return c.json(await issueSession(c, updated))
  })
  .get("/addresses", async (c) => {
    const list = await c.get("accounts").listAddresses(c.get("auth").userId)
    return c.json({ addresses: list.map(publicAddress) })
  })
  .post("/addresses", async (c) => {
    const body = parse(AddressBody, await readJsonBody(c))
    try {
      const a = await c.get("accounts").createAddress(c.get("auth").userId, body)
      return c.json({ address: publicAddress(a) }, 201)
    } catch (err) {
      if (err instanceof AddressLimitError) throw new HTTPException(409, { message: err.message })
      throw err
    }
  })
  .patch("/addresses/:id", async (c) => {
    const body = parse(AddressPatch, await readJsonBody(c))
    const { isDefault, ...patch } = body
    const store = c.get("accounts")
    const userId = c.get("auth").userId
    let a = Object.keys(patch).length ? await store.updateAddress(userId, c.req.param("id"), patch) : null
    if (isDefault) a = await store.setDefaultAddress(userId, c.req.param("id"))
    if (!a) {
      const exists = (await store.listAddresses(userId)).find((x) => x.id === c.req.param("id"))
      if (!exists) throw new HTTPException(404, { message: "address not found" })
      a = exists
    }
    return c.json({ address: publicAddress(a) })
  })
  .post("/addresses/:id/default", async (c) => {
    const a = await c.get("accounts").setDefaultAddress(c.get("auth").userId, c.req.param("id"))
    if (!a) throw new HTTPException(404, { message: "address not found" })
    return c.json({ address: publicAddress(a) })
  })
  .delete("/addresses/:id", async (c) => {
    const ok = await c.get("accounts").deleteAddress(c.get("auth").userId, c.req.param("id"))
    if (!ok) throw new HTTPException(404, { message: "address not found" })
    return c.json({ ok: true })
  })
