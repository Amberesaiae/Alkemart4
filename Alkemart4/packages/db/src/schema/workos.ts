import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { users } from "./users"

export const workosIdentities = pgTable("workos_identities", {
  clientId: text("client_id").notNull(),
  subject: text("subject").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("workos_identity_subject").on(t.clientId, t.subject), uniqueIndex("workos_identity_user").on(t.clientId, t.userId)])

export const workosAttempts = pgTable("workos_attempts", {
  stateHash: text("state_hash").primaryKey(),
  browserHash: text("browser_hash").notNull(),
  encryptedData: text("encrypted_data").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
})

export const workosSessions = pgTable("workos_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  clientId: text("client_id").notNull(),
  actor: text("actor").notNull(),
  secretHash: text("secret_hash").notNull(),
  encryptedRefresh: text("encrypted_refresh").notNull(),
  passwordVersion: text("password_version").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
  lockId: text("lock_id"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
