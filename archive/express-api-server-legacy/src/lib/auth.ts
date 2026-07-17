import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";
import { db, sessionsTable, userRolesTable, usersTable } from "@workspace/db";
import type { AuthUserRole } from "@workspace/abilities";

import {
  DEFAULT_COUNTRY_CODE,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  SESSION_TTL_MS,
} from "./platform-config";

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;
const SESSION_COOKIE = "session_token";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) {
    return false;
  }
  const derivedKey = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  const storedKey = Buffer.from(hashHex, "hex");
  if (storedKey.length !== derivedKey.length) {
    return false;
  }
  return timingSafeEqual(storedKey, derivedKey);
}

export async function createSession(userId: number) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({ userId, token, expiresAt });
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export async function destroyAllUserSessions(userId: number) {
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
}

export function setSessionCookie(res: import("express").Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: import("express").Response) {
  res.clearCookie(SESSION_COOKIE);
}

export function getSessionTokenFromRequest(req: import("express").Request): string | undefined {
  return req.cookies?.[SESSION_COOKIE] as string | undefined;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  countryCode: string;
  preferredCurrency: string;
  locale: string;
  roles: AuthUserRole[];
}

export function toAuthUserPayload(user: {
  id: number;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  countryCode?: string | null;
  preferredCurrency?: string | null;
  locale?: string | null;
}, roles: AuthUserRole[]) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    countryCode: user.countryCode ?? DEFAULT_COUNTRY_CODE,
    preferredCurrency: user.preferredCurrency ?? DEFAULT_CURRENCY,
    locale: user.locale ?? DEFAULT_LOCALE,
    roles,
  };
}

export async function loadUserFromSessionToken(token: string): Promise<AuthenticatedUser | null> {
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token));
  if (!session || session.expiresAt.getTime() < Date.now()) {
    return null;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
  if (!user) {
    return null;
  }

  const roleRows = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, user.id));
  const roles = roleRows.map((r) => ({ role: r.role, vendorId: r.vendorId }));
  const payload = toAuthUserPayload(user, roles);

  return {
    ...payload,
    roles,
  };
}

export async function getUserRoles(userId: number): Promise<AuthUserRole[]> {
  const roleRows = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId));
  return roleRows.map((r) => ({ role: r.role, vendorId: r.vendorId }));
}
