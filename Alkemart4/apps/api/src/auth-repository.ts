import { sellerMembers, sellers, users } from "@alkemart/db"
import type { SellerStatus } from "@alkemart/domain"
import type { PaystackMomoProvider } from "@alkemart/shared/ghana"
import { resolveMarket } from "@alkemart/shared/markets"
import { and, eq, isNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type UserRole = "buyer" | "seller_member" | "admin"
export type SellerMemberRole = "owner" | "staff"

export type AuthUser = {
  id: string
  email: string
  passwordHash: string
  role: UserRole
  createdAt: Date
  /** Profile (0037) — optional so legacy rows and fixtures still type. */
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  passwordChangedAt?: Date | null
  emailVerifiedAt?: Date | null
}

export type UserProfilePatch = { firstName?: string | null; lastName?: string | null; phone?: string | null }

export type SellerAvailability = "open" | "paused"

export type AuthSeller = {
  id: string
  handle: string
  name: string
  description: string | null
  logo: string | null
  banner: string | null
  metadata: Record<string, unknown> | null
  status: SellerStatus
  commissionBps: number
  deliveryFeePesewas: bigint
  recipientCode: string | null
  createdAt: Date
  availability: SellerAvailability
  pausedUntil: Date | null
  pauseNote: string | null
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
  openShopForUser(userId: string, seller: { id: string; name: string; handle: string }): Promise<AuthUser>
  createUser(input: {
    id: string
    email: string
    passwordHash: string
    role: UserRole
  }): Promise<AuthUser>
  findUserByEmail(email: string): Promise<AuthUser | null>
  findUserById(id: string): Promise<AuthUser | null>
  updateUserProfile(id: string, patch: UserProfilePatch): Promise<AuthUser>
  /** Sets the hash and stamps password_changed_at (older sessions go stale). */
  updateUserPassword(id: string, passwordHash: string): Promise<AuthUser>
  markEmailVerified(id: string): Promise<AuthUser>
  /** Compare-and-swap hash upgrade; do not revoke sessions or undo a concurrent reset. */
  rehashUserPassword(id: string, previousHash: string, passwordHash: string): Promise<AuthUser | null>
  findSellerById(id: string): Promise<AuthSeller | null>
  findSellerByHandle(handle: string): Promise<AuthSeller | null>
  listSellers(): Promise<AuthSeller[]>
  findSellerMemberByUserId(userId: string): Promise<AuthSellerMember | null>
  listSellerMembers(sellerId: string): Promise<(AuthSellerMember & { email: string })[]>
  registerVendor(input: {
    user: { id: string; email: string; passwordHash: string }
    seller: { id: string; handle: string; name: string }
  }): Promise<{ user: AuthUser; seller: AuthSeller; member: AuthSellerMember }>
  updateSellerGhanaSetup(id: string, patch: SellerGhanaSetupPatch): Promise<AuthSeller>
  updateSellerProfile(
    id: string,
    patch: { name?: string; handle?: string; description?: string | null; logo?: string | null; banner?: string | null },
  ): Promise<AuthSeller>
  updateSellerAddress(
    id: string,
    patch: {
      packRegion?: string | null
      digitalAddress?: string | null
      deliveryFeePesewas?: bigint
      metadata?: Record<string, unknown> | null
      /** Pinpoint location (0035) — real columns, not metadata. */
      lat?: number | null
      lng?: number | null
      district?: string | null
      locationSetAt?: Date | null
    },
  ): Promise<AuthSeller>
  updateSellerPayment(
    id: string,
    patch: { momoProvider: PaystackMomoProvider; momoPhone: string; recipientCode: string },
  ): Promise<AuthSeller>
  patchSellerMetadata(id: string, merge: Record<string, unknown>): Promise<AuthSeller>
  updateSellerStatus(id: string, status: SellerStatus): Promise<AuthSeller | null>
  updateSellerCommission(id: string, commissionBps: number): Promise<AuthSeller | null>
  updateSellerAvailability(
    id: string,
    patch: { availability: SellerAvailability; pausedUntil: Date | null; pauseNote: string | null },
  ): Promise<AuthSeller | null>
}

function toUser(row: {
  id: string
  email: string
  passwordHash: string
  role: UserRole
  createdAt: Date
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  passwordChangedAt?: Date | null
  emailVerifiedAt?: Date | null
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    createdAt: row.createdAt,
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    phone: row.phone ?? null,
    passwordChangedAt: row.passwordChangedAt ?? null,
    emailVerifiedAt: row.emailVerifiedAt ?? null,
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
  description: string | null
  logo: string | null
  banner: string | null
  metadata: Record<string, unknown> | null
  status: SellerStatus
  commissionBps: number
  deliveryFeePesewas: bigint | string | number
  recipientCode: string | null
  momoProvider: string | null
  momoPhone: string | null
  packRegion: string | null
  digitalAddress: string | null
  createdAt: Date
  availability: SellerAvailability
  pausedUntil: Date | null
  pauseNote: string | null
}): AuthSeller {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    description: row.description,
    logo: row.logo,
    banner: row.banner,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
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
    createdAt: row.createdAt,
    availability: row.availability === "paused" ? "paused" : "open",
    pausedUntil: row.pausedUntil ?? null,
    pauseNote: row.pauseNote ?? null,
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

  async openShopForUser(userId: string, input: { id: string; name: string; handle: string }) {
    const user = this.usersById.get(userId)
    if (!user || user.role === "admin" || this.membersByUserId.has(userId)) throw new Error("account cannot open shop")
    if (this.sellersByHandle.has(input.handle)) throw new AuthConflictError("handle")
    const seller: AuthSeller = { ...input, description: null, logo: null, banner: null, metadata: null, status: "pending_approval", commissionBps: resolveMarket().defaultCommissionBps, createdAt: new Date(), availability: "open", pausedUntil: null, pauseNote: null, ...unsetOnboarding() }
    this.sellersById.set(seller.id, seller)
    this.sellersByHandle.set(seller.handle, seller)
    this.membersByUserId.set(userId, { userId, sellerId: seller.id, role: "owner" })
    user.role = "seller_member"
    return { ...user }
  }

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

  async findUserById(id: string) {
    return this.usersById.get(id) ?? null
  }

  async updateUserProfile(id: string, patch: UserProfilePatch) {
    const u = this.usersById.get(id)
    if (!u) throw new Error("user not found")
    Object.assign(u, patch)
    return { ...u }
  }

  async updateUserPassword(id: string, passwordHash: string) {
    const u = this.usersById.get(id)
    if (!u) throw new Error("user not found")
    u.passwordHash = passwordHash
    u.passwordChangedAt = new Date()
    return { ...u }
  }

  async markEmailVerified(id: string) {
    const u = this.usersById.get(id)
    if (!u) throw new Error("user not found")
    u.emailVerifiedAt ??= new Date()
    return { ...u }
  }

  async rehashUserPassword(id: string, previousHash: string, passwordHash: string) {
    const u = this.usersById.get(id)
    if (!u || u.passwordHash !== previousHash) return null
    u.passwordHash = passwordHash
    return { ...u }
  }

  async findSellerById(id: string) {
    return this.sellersById.get(id) ?? null
  }

  async findSellerByHandle(handle: string) {
    return this.sellersByHandle.get(handle) ?? null
  }

  async listSellers() {
    return [...this.sellersById.values()]
  }

  async findSellerMemberByUserId(userId: string) {
    return this.membersByUserId.get(userId) ?? null
  }

  async listSellerMembers(sellerId: string) {
    const out: (AuthSellerMember & { email: string })[] = []
    for (const member of this.membersByUserId.values()) {
      if (member.sellerId !== sellerId) continue
      const user = this.usersById.get(member.userId)
      out.push({ ...member, email: user?.email ?? "" })
    }
    return out
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
      description: null,
      logo: null,
      banner: null,
      metadata: null,
      status: "pending_approval",
      // Market-resolved default (single-market today); admins adjust per seller.
      commissionBps: resolveMarket().defaultCommissionBps,
      createdAt: new Date(),
      availability: "open",
      pausedUntil: null,
      pauseNote: null,
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

  private saveSeller(next: AuthSeller) {
    // Drop the stale handle key when the handle changed.
    for (const [handle, seller] of this.sellersByHandle) {
      if (seller.id === next.id && handle !== next.handle) this.sellersByHandle.delete(handle)
    }
    this.sellersById.set(next.id, next)
    this.sellersByHandle.set(next.handle, next)
    return next
  }

  async updateSellerProfile(
    id: string,
    patch: { name?: string; handle?: string; description?: string | null; logo?: string | null; banner?: string | null },
  ) {
    const seller = this.sellersById.get(id)
    if (!seller) throw new Error("seller not found")
    if (patch.handle && patch.handle !== seller.handle && this.sellersByHandle.has(patch.handle)) {
      throw new AuthConflictError("handle")
    }
    return this.saveSeller({ ...seller, ...patch })
  }

  async updateSellerAddress(
    id: string,
    patch: {
      packRegion?: string | null
      digitalAddress?: string | null
      deliveryFeePesewas?: bigint
      metadata?: Record<string, unknown> | null
      /** Pinpoint location (0035) — real columns, not metadata. */
      lat?: number | null
      lng?: number | null
      district?: string | null
      locationSetAt?: Date | null
    },
  ) {
    const seller = this.sellersById.get(id)
    if (!seller) throw new Error("seller not found")
    // Like Postgres: an undefined field means "leave it", never "erase it".
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
    return this.saveSeller({ ...seller, ...defined })
  }

  async updateSellerPayment(
    id: string,
    patch: { momoProvider: PaystackMomoProvider; momoPhone: string; recipientCode: string },
  ) {
    const seller = this.sellersById.get(id)
    if (!seller) throw new Error("seller not found")
    return this.saveSeller({ ...seller, ...patch })
  }

  async patchSellerMetadata(id: string, merge: Record<string, unknown>) {
    const seller = this.sellersById.get(id)
    if (!seller) throw new Error("seller not found")
    return this.saveSeller({ ...seller, metadata: { ...(seller.metadata ?? {}), ...merge } })
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

  async updateSellerAvailability(
    id: string,
    patch: { availability: SellerAvailability; pausedUntil: Date | null; pauseNote: string | null },
  ) {
    const seller = this.sellersById.get(id)
    if (!seller) return null
    const next: AuthSeller = { ...seller, ...patch }
    this.sellersById.set(id, next)
    this.sellersByHandle.set(next.handle, next)
    return next
  }
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  async openShopForUser(userId: string, input: { id: string; name: string; handle: string }) {
    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update")
        const members = await tx.select().from(sellerMembers).where(eq(sellerMembers.userId, userId))
        if (!user || user.role === "admin" || members.length) throw new Error("account cannot open shop")
        await tx.insert(sellers).values({ ...input, status: "pending_approval", commissionBps: resolveMarket().defaultCommissionBps })
        await tx.insert(sellerMembers).values({ userId, sellerId: input.id, role: "owner" })
        const [updated] = await tx.update(users).set({ role: "seller_member" }).where(eq(users.id, userId)).returning()
        return toUser(updated!)
      })
    } catch (error) {
      const field = uniqueField(error)
      if (field) throw new AuthConflictError(field)
      throw error
    }
  }

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

  async findUserById(id: string) {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
    return row ? toUser(row) : null
  }

  async updateUserProfile(id: string, patch: UserProfilePatch) {
    const [row] = await this.db.update(users).set(patch).where(eq(users.id, id)).returning()
    if (!row) throw new Error("user not found")
    return toUser(row)
  }

  async updateUserPassword(id: string, passwordHash: string) {
    const [row] = await this.db
      .update(users)
      .set({ passwordHash, passwordChangedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
    if (!row) throw new Error("user not found")
    return toUser(row)
  }

  async markEmailVerified(id: string) {
    const [row] = await this.db.update(users).set({ emailVerifiedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.emailVerifiedAt))).returning()
    if (row) return toUser(row)
    const existing = await this.findUserById(id)
    if (!existing) throw new Error("user not found")
    return existing
  }

  async rehashUserPassword(id: string, previousHash: string, passwordHash: string) {
    const [row] = await this.db.update(users).set({ passwordHash })
      .where(and(eq(users.id, id), eq(users.passwordHash, previousHash))).returning()
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

  async listSellers() {
    const rows = await this.db.select().from(sellers)
    return rows.map(toSeller)
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

  async listSellerMembers(sellerId: string) {
    const rows = await this.db
      .select({ userId: sellerMembers.userId, role: sellerMembers.role, email: users.email })
      .from(sellerMembers)
      .innerJoin(users, eq(sellerMembers.userId, users.id))
      .where(eq(sellerMembers.sellerId, sellerId))
    return rows.map((row) => ({ userId: row.userId, sellerId, role: row.role, email: row.email }))
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
            // Explicit, not the DB default: the market owns this number.
            commissionBps: resolveMarket().defaultCommissionBps,
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

  private async patchSeller(id: string, patch: Partial<typeof sellers.$inferInsert>) {
    try {
      const [row] = await this.db
        .update(sellers)
        .set(patch)
        .where(eq(sellers.id, id))
        .returning()
      if (!row) throw new Error("seller not found")
      return toSeller(row)
    } catch (err) {
      if (err instanceof Error && err.message === "seller not found") throw err
      const field = uniqueField(err)
      if (field) throw new AuthConflictError(field)
      throw err
    }
  }

  async updateSellerProfile(
    id: string,
    patch: { name?: string; handle?: string; description?: string | null; logo?: string | null; banner?: string | null },
  ) {
    return this.patchSeller(id, patch)
  }

  async updateSellerAddress(
    id: string,
    patch: {
      packRegion?: string | null
      digitalAddress?: string | null
      deliveryFeePesewas?: bigint
      metadata?: Record<string, unknown> | null
      /** Pinpoint location (0035) — real columns, not metadata. */
      lat?: number | null
      lng?: number | null
      district?: string | null
      locationSetAt?: Date | null
    },
  ) {
    return this.patchSeller(id, patch)
  }

  async updateSellerPayment(
    id: string,
    patch: { momoProvider: PaystackMomoProvider; momoPhone: string; recipientCode: string },
  ) {
    return this.patchSeller(id, patch)
  }

  async patchSellerMetadata(id: string, merge: Record<string, unknown>) {
    const current = await this.findSellerById(id)
    if (!current) throw new Error("seller not found")
    return this.patchSeller(id, { metadata: { ...(current.metadata ?? {}), ...merge } })
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

  async updateSellerAvailability(
    id: string,
    patch: { availability: SellerAvailability; pausedUntil: Date | null; pauseNote: string | null },
  ) {
    const [row] = await this.db
      .update(sellers)
      .set({ availability: patch.availability, pausedUntil: patch.pausedUntil, pauseNote: patch.pauseNote })
      .where(eq(sellers.id, id))
      .returning()
    return row ? toSeller(row) : null
  }
}
