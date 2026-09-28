import { buyerAddresses, emailVerificationTokens, passwordResetTokens } from "@alkemart/db"
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/**
 * Buyer address book + password reset tokens (0037).
 *
 * Invariants:
 *  - An address belongs to exactly one user; every read/write is scoped by
 *    userId, so one buyer can never see or edit another's address.
 *  - At most one default per buyer. Setting a default clears the others in
 *    the same unit of work; the first address saved becomes the default.
 *  - Reset tokens are looked up by SHA-256 hash, consumed atomically
 *    (unused AND unexpired → used), and a new request voids older ones.
 */

export type AddressInput = {
  label?: string | null
  firstName: string
  lastName: string
  phone: string
  address1: string
  address2?: string | null
  city: string
  province?: string | null
  postalCode?: string | null
  countryCode: string
  latitude?: number | null
  longitude?: number | null
}

export type Address = AddressInput & {
  id: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export const MAX_ADDRESSES = 20

export interface AccountStore {
  listAddresses(userId: string): Promise<Address[]>
  createAddress(userId: string, input: AddressInput & { isDefault?: boolean }): Promise<Address>
  updateAddress(userId: string, id: string, patch: Partial<AddressInput>): Promise<Address | null>
  deleteAddress(userId: string, id: string): Promise<boolean>
  setDefaultAddress(userId: string, id: string): Promise<Address | null>
  createResetToken(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>
  /** Marks the token used and returns its user — or null if unknown/used/expired. */
  consumeResetToken(tokenHash: string, now?: Date): Promise<string | null>
  createEmailVerificationToken(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>
  consumeEmailVerificationToken(tokenHash: string, now?: Date): Promise<string | null>
}

export class AddressLimitError extends Error {
  constructor() {
    super(`You can save up to ${MAX_ADDRESSES} addresses`)
  }
}

// ─── In-memory ──────────────────────────────────────────────────────────

export class InMemoryAccountStore implements AccountStore {
  private addresses: (Address & { userId: string })[] = []
  private tokens: { userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }[] = []
  private verificationTokens: { userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }[] = []

  private strip(a: Address & { userId: string }): Address {
    const { userId, ...rest } = a
    void userId
    return { ...rest }
  }

  async listAddresses(userId: string) {
    return this.addresses
      .filter((a) => a.userId === userId)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((a) => this.strip(a))
  }

  async createAddress(userId: string, input: AddressInput & { isDefault?: boolean }) {
    const mine = this.addresses.filter((a) => a.userId === userId)
    if (mine.length >= MAX_ADDRESSES) throw new AddressLimitError()
    const isDefault = input.isDefault || mine.length === 0
    if (isDefault) mine.forEach((a) => (a.isDefault = false))
    const now = new Date()
    const row = { ...input, id: crypto.randomUUID(), userId, isDefault, createdAt: now, updatedAt: now }
    this.addresses.push(row)
    return this.strip(row)
  }

  async updateAddress(userId: string, id: string, patch: Partial<AddressInput>) {
    const row = this.addresses.find((a) => a.id === id && a.userId === userId)
    if (!row) return null
    Object.assign(row, patch, { updatedAt: new Date() })
    return this.strip(row)
  }

  async deleteAddress(userId: string, id: string) {
    const row = this.addresses.find((a) => a.id === id && a.userId === userId)
    if (!row) return false
    this.addresses = this.addresses.filter((a) => a !== row)
    if (row.isDefault) {
      const next = this.addresses.filter((a) => a.userId === userId).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
      if (next) next.isDefault = true
    }
    return true
  }

  async setDefaultAddress(userId: string, id: string) {
    const row = this.addresses.find((a) => a.id === id && a.userId === userId)
    if (!row) return null
    this.addresses.filter((a) => a.userId === userId).forEach((a) => (a.isDefault = a === row))
    return this.strip(row)
  }

  async createResetToken(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    this.tokens.filter((t) => t.userId === input.userId && !t.usedAt).forEach((t) => (t.usedAt = new Date()))
    this.tokens.push({ ...input, usedAt: null })
  }

  async consumeResetToken(tokenHash: string, now = new Date()) {
    const t = this.tokens.find((x) => x.tokenHash === tokenHash && !x.usedAt && x.expiresAt > now)
    if (!t) return null
    t.usedAt = now
    return t.userId
  }

  async createEmailVerificationToken(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    this.verificationTokens.filter((t) => t.userId === input.userId && !t.usedAt).forEach((t) => (t.usedAt = new Date()))
    this.verificationTokens.push({ ...input, usedAt: null })
  }

  async consumeEmailVerificationToken(tokenHash: string, now = new Date()) {
    const t = this.verificationTokens.find((x) => x.tokenHash === tokenHash && !x.usedAt && x.expiresAt > now)
    if (!t) return null
    t.usedAt = now
    return t.userId
  }
}

// ─── Postgres ───────────────────────────────────────────────────────────

type Row = typeof buyerAddresses.$inferSelect

function toAddress(r: Row): Address {
  return {
    id: r.id,
    label: r.label,
    firstName: r.firstName,
    lastName: r.lastName,
    phone: r.phone,
    address1: r.address1,
    address2: r.address2,
    city: r.city,
    province: r.province,
    postalCode: r.postalCode,
    countryCode: r.countryCode,
    latitude: r.latitude,
    longitude: r.longitude,
    isDefault: r.isDefault,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export class PostgresAccountStore implements AccountStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async listAddresses(userId: string) {
    const rows = await this.db
      .select()
      .from(buyerAddresses)
      .where(eq(buyerAddresses.userId, userId))
      .orderBy(desc(buyerAddresses.isDefault), desc(buyerAddresses.updatedAt), asc(buyerAddresses.id))
    return rows.map(toAddress)
  }

  async createAddress(userId: string, input: AddressInput & { isDefault?: boolean }) {
    return this.db.transaction(async (tx) => {
      const mine = await tx.select({ id: buyerAddresses.id }).from(buyerAddresses).where(eq(buyerAddresses.userId, userId))
      if (mine.length >= MAX_ADDRESSES) throw new AddressLimitError()
      const isDefault = Boolean(input.isDefault) || mine.length === 0
      if (isDefault) await tx.update(buyerAddresses).set({ isDefault: false }).where(eq(buyerAddresses.userId, userId))
      const [row] = await tx
        .insert(buyerAddresses)
        .values({ ...input, id: crypto.randomUUID(), userId, isDefault })
        .returning()
      if (!row) throw new Error("failed to save address")
      return toAddress(row)
    })
  }

  async updateAddress(userId: string, id: string, patch: Partial<AddressInput>) {
    const [row] = await this.db
      .update(buyerAddresses)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(buyerAddresses.id, id), eq(buyerAddresses.userId, userId)))
      .returning()
    return row ? toAddress(row) : null
  }

  async deleteAddress(userId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const [gone] = await tx
        .delete(buyerAddresses)
        .where(and(eq(buyerAddresses.id, id), eq(buyerAddresses.userId, userId)))
        .returning()
      if (!gone) return false
      if (gone.isDefault) {
        const [next] = await tx
          .select({ id: buyerAddresses.id })
          .from(buyerAddresses)
          .where(eq(buyerAddresses.userId, userId))
          .orderBy(desc(buyerAddresses.updatedAt))
          .limit(1)
        if (next) await tx.update(buyerAddresses).set({ isDefault: true }).where(eq(buyerAddresses.id, next.id))
      }
      return true
    })
  }

  async setDefaultAddress(userId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const [own] = await tx
        .select({ id: buyerAddresses.id })
        .from(buyerAddresses)
        .where(and(eq(buyerAddresses.id, id), eq(buyerAddresses.userId, userId)))
        .limit(1)
      if (!own) return null
      await tx.update(buyerAddresses).set({ isDefault: false }).where(eq(buyerAddresses.userId, userId))
      const [row] = await tx.update(buyerAddresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(buyerAddresses.id, id)).returning()
      return row ? toAddress(row) : null
    })
  }

  async createResetToken(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    await this.db.transaction(async (tx) => {
      // A new request voids any older unused link.
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, input.userId), isNull(passwordResetTokens.usedAt)))
      await tx.insert(passwordResetTokens).values({ id: crypto.randomUUID(), ...input })
    })
  }

  async consumeResetToken(tokenHash: string, now = new Date()) {
    // Single statement: only one concurrent request can flip used_at.
    const [row] = await this.db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)),
      )
      .returning({ userId: passwordResetTokens.userId })
    return row?.userId ?? null
  }

  async createEmailVerificationToken(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    await this.db.transaction(async (tx) => {
      await tx.update(emailVerificationTokens).set({ usedAt: new Date() })
        .where(and(eq(emailVerificationTokens.userId, input.userId), isNull(emailVerificationTokens.usedAt)))
      await tx.insert(emailVerificationTokens).values({ id: crypto.randomUUID(), ...input })
    })
  }

  async consumeEmailVerificationToken(tokenHash: string, now = new Date()) {
    const [row] = await this.db.update(emailVerificationTokens).set({ usedAt: now })
      .where(and(eq(emailVerificationTokens.tokenHash, tokenHash), isNull(emailVerificationTokens.usedAt), gt(emailVerificationTokens.expiresAt, now)))
      .returning({ userId: emailVerificationTokens.userId })
    return row?.userId ?? null
  }
}
