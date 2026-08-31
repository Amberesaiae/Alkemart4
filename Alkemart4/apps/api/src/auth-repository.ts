import { sellerMembers, sellers, users } from "@alkemart/db"
import type { SellerStatus } from "@alkemart/domain"
import type { PaystackMomoProvider } from "@alkemart/shared/ghana"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type UserRole = "buyer" | "seller_member" | "admin"
export type SellerMemberRole = "owner" | "staff"

export type AuthUser = {
  id: string
  email: string
  passwordHash: string
  role: UserRole
  createdAt: Date
}

export type AuthSeller = {
  id: string
  handle: string
  name: string
  status: SellerStatus
  commissionBps: number
  deliveryFeePesewas: bigint
  recipientCode: string | null
  momoProvider: PaystackMomoProvider | null
  momoPhone: string | null
  packRegion: string | null
  digitalAddress: string | null
}

export type SellerGhanaSetupPatch = {
  name: string
  packRegion: string
  digitalAddress: string | null
  deliveryFeePesewas: bigint
  momoProvider: PaystackMomoProvider
  momoPhone: string
  recipientCode: string
}

export type AuthSellerMember = {
  userId: string
  sellerId: string
  role: SellerMemberRole
}

export class AuthConflictError extends Error {
  readonly field: "email" | "handle"
  constructor(field: "email" | "handle") {
    super(`${field} already exists`)
    this.name = "AuthConflictError"
    this.field = field
  }
}

export interface AuthRepository {
  createUser(input: {
    id: string
    email: string
    passwordHash: string
    role: UserRole
  }): Promise<AuthUser>
  findUserByEmail(email: string): Promise<AuthUser | null>
  findSellerById(id: string): Promise<AuthSeller | null>
  findSellerByHandle(handle: string): Promise<AuthSeller | null>
  findSellerMemberByUserId(userId: string): Promise<AuthSellerMember | null>
  registerVendor(input: {
    user: { id: string; email: string; passwordHash: string }
    seller: { id: string; handle: string; name: string }
  }): Promise<{ user: AuthUser; seller: AuthSeller; member: AuthSellerMember }>
  updateSellerGhanaSetup(id: string, patch: SellerGhanaSetupPatch): Promise<AuthSeller>
  updateSellerStatus(id: string, status: SellerStatus): Promise<AuthSeller | null>
  updateSellerCommission(id: string, commissionBps: number): Promise<AuthSeller | null>
}

function toUser(row: {
  id: string
  email: string
  passwordHash: string
  role: UserRole
  createdAt: Date
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    createdAt: row.createdAt,
  }
}

function toMomoProvider(value: string | null): PaystackMomoProvider | null {
  if (value === "mtn" || value === "vodafone" || value === "airteltigo") return value
  return null
}

function toSeller(row: {
  id: string
  handle: string
  name: string
  status: SellerStatus
  commissionBps: number
  deliveryFeePesewas: bigint | string | number
  recipientCode: string | null
  momoProvider: string | null
  momoPhone: string | null
  packRegion: string | null
  digitalAddress: string | null
}): AuthSeller {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    status: row.status,
    commissionBps: row.commissionBps,
    deliveryFeePesewas:
      typeof row.deliveryFeePesewas === "bigint"
        ? row.deliveryFeePesewas
        : BigInt(row.deliveryFeePesewas),
    recipientCode: row.recipientCode,
    momoProvider: toMomoProvider(row.momoProvider),
    momoPhone: row.momoPhone,
    packRegion: row.packRegion,
    digitalAddress: row.digitalAddress,
  }
}

function unsetOnboarding(): Pick<
  AuthSeller,
  | "deliveryFeePesewas"
  | "recipientCode"
  | "momoProvider"
  | "momoPhone"
  | "packRegion"
  | "digitalAddress"
> {
  return {
    deliveryFeePesewas: 0n,
    recipientCode: null,
    momoProvider: null,
    momoPhone: null,
    packRegion: null,
    digitalAddress: null,
  }
}

function uniqueField(err: unknown): "email" | "handle" | null {
  let current: unknown = err
  while (current && typeof current === "object") {
    const rec = current as Record<string, unknown>
    const code = rec.code
    const constraint =
      (typeof rec.constraint_name === "string" && rec.constraint_name) ||
      (typeof rec.constraint === "string" && rec.constraint) ||
      ""
    if (code === "23505") {
      if (constraint.includes("email")) return "email"
      if (constraint.includes("handle")) return "handle"
      return "email"
    }
    current = rec.cause
  }
  return null
}

export class InMemoryAuthRepository implements AuthRepository {
  private readonly usersById = new Map<string, AuthUser>()
  private readonly usersByEmail = new Map<string, AuthUser>()
  private readonly sellersById = new Map<string, AuthSeller>()
  private readonly sellersByHandle = new Map<string, AuthSeller>()
  private readonly membersByUserId = new Map<string, AuthSellerMember>()

  async createUser(input: {
    id: string
    email: string
    passwordHash: string
    role: UserRole
  }): Promise<AuthUser> {
    if (this.usersByEmail.has(input.email)) throw new AuthConflictError("email")
    const user: AuthUser = { ...input, createdAt: new Date() }
    this.usersById.set(user.id, user)
    this.usersByEmail.set(user.email, user)
    return user
  }

  async findUserByEmail(email: string) {
    return this.usersByEmail.get(email) ?? null
  }

  async findSellerById(id: string) {
    return this.sellersById.get(id) ?? null
  }

  async findSellerByHandle(handle: string) {
    return this.sellersByHandle.get(handle) ?? null
  }

  async findSellerMemberByUserId(userId: string) {
    return this.membersByUserId.get(userId) ?? null
  }

  async registerVendor(input: {
    user: { id: string; email: string; passwordHash: string }
    seller: { id: string; handle: string; name: string }
  }) {
    if (this.usersByEmail.has(input.user.email)) throw new AuthConflictError("email")
    if (this.sellersByHandle.has(input.seller.handle)) throw new AuthConflictError("handle")
    const user = await this.createUser({ ...input.user, role: "seller_member" })
    const seller: AuthSeller = {
      ...input.seller,
      status: "pending_approval",
      commissionBps: 700,
      ...unsetOnboarding(),
    }
    this.sellersById.set(seller.id, seller)
    this.sellersByHandle.set(seller.handle, seller)
    const member: AuthSellerMember = { userId: user.id, sellerId: seller.id, role: "owner" }
    this.membersByUserId.set(user.id, member)
    return { user, seller, member }
  }

  async updateSellerGhanaSetup(id: string, patch: SellerGhanaSetupPatch) {
    const seller = this.sellersById.get(id)
    if (!seller) throw new Error("seller not found")
    const next: AuthSeller = { ...seller, ...patch }
    this.sellersById.set(id, next)
    this.sellersByHandle.set(next.handle, next)
    return next
  }

  async updateSellerStatus(id: string, status: SellerStatus) {
    const seller = this.sellersById.get(id)
    if (!seller) return null
    const next: AuthSeller = { ...seller, status }
    this.sellersById.set(id, next)
    this.sellersByHandle.set(next.handle, next)
    return next
  }

  async updateSellerCommission(id: string, commissionBps: number) {
    const seller = this.sellersById.get(id)
    if (!seller) return null
    const next: AuthSeller = { ...seller, commissionBps }
    this.sellersById.set(id, next)
    this.sellersByHandle.set(next.handle, next)
    return next
  }
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  async createUser(input: {
    id: string
    email: string
    passwordHash: string
    role: UserRole
  }): Promise<AuthUser> {
    try {
      const [row] = await this.db
        .insert(users)
        .values({
          id: input.id,
          email: input.email,
          passwordHash: input.passwordHash,
          role: input.role,
        })
        .returning()
      if (!row) throw new Error("failed to create user")
      return toUser(row)
    } catch (err) {
      const field = uniqueField(err)
      if (field) throw new AuthConflictError(field)
      throw err
    }
  }

  async findUserByEmail(email: string) {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1)
    return row ? toUser(row) : null
  }

  async findSellerById(id: string) {
    const [row] = await this.db.select().from(sellers).where(eq(sellers.id, id)).limit(1)
    return row ? toSeller(row) : null
  }

  async findSellerByHandle(handle: string) {
    const [row] = await this.db.select().from(sellers).where(eq(sellers.handle, handle)).limit(1)
    return row ? toSeller(row) : null
  }

  async findSellerMemberByUserId(userId: string) {
    const [row] = await this.db
      .select()
      .from(sellerMembers)
      .where(eq(sellerMembers.userId, userId))
      .limit(1)
    return row
      ? { userId: row.userId, sellerId: row.sellerId, role: row.role }
      : null
  }

  async registerVendor(input: {
    user: { id: string; email: string; passwordHash: string }
    seller: { id: string; handle: string; name: string }
  }) {
    try {
      return await this.db.transaction(async (tx) => {
        const [userRow] = await tx
          .insert(users)
          .values({
            id: input.user.id,
            email: input.user.email,
            passwordHash: input.user.passwordHash,
            role: "seller_member",
          })
          .returning()
        if (!userRow) throw new Error("failed to create user")
        const [sellerRow] = await tx
          .insert(sellers)
          .values({
            id: input.seller.id,
            handle: input.seller.handle,
            name: input.seller.name,
            status: "pending_approval",
          })
          .returning()
        if (!sellerRow) throw new Error("failed to create seller")
        const [memberRow] = await tx
          .insert(sellerMembers)
          .values({
            userId: userRow.id,
            sellerId: sellerRow.id,
            role: "owner",
          })
          .returning()
        if (!memberRow) throw new Error("failed to create seller member")
        return {
          user: toUser(userRow),
          seller: toSeller(sellerRow),
          member: {
            userId: memberRow.userId,
            sellerId: memberRow.sellerId,
            role: memberRow.role,
          },
        }
      })
    } catch (err) {
      if (err instanceof AuthConflictError) throw err
      const field = uniqueField(err)
      if (field) throw new AuthConflictError(field)
      throw err
    }
  }

  async updateSellerGhanaSetup(id: string, patch: SellerGhanaSetupPatch) {
    const [row] = await this.db
      .update(sellers)
      .set({
        name: patch.name,
        packRegion: patch.packRegion,
        digitalAddress: patch.digitalAddress,
        deliveryFeePesewas: patch.deliveryFeePesewas,
        momoProvider: patch.momoProvider,
        momoPhone: patch.momoPhone,
        recipientCode: patch.recipientCode,
      })
      .where(eq(sellers.id, id))
      .returning()
    if (!row) throw new Error("seller not found")
    return toSeller(row)
  }

  async updateSellerStatus(id: string, status: SellerStatus) {
    const [row] = await this.db
      .update(sellers)
      .set({ status })
      .where(eq(sellers.id, id))
      .returning()
    return row ? toSeller(row) : null
  }

  async updateSellerCommission(id: string, commissionBps: number) {
    const [row] = await this.db
      .update(sellers)
      .set({ commissionBps })
      .where(eq(sellers.id, id))
      .returning()
    return row ? toSeller(row) : null
  }
}
