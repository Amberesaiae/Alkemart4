import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { db, usersTable, userRolesTable, passwordResetTokensTable } from "@workspace/db";
import {
  SignupBody,
  SignupResponse,
  LoginBody,
  LoginResponse,
  GetMeResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth-session";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  getSessionTokenFromRequest,
  getUserRoles,
  toAuthUserPayload,
} from "../lib/auth";
import {
  DEFAULT_COUNTRY_CODE,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
} from "../lib/platform-config";
import { sendEmail } from "../lib/email";
import { randomBytes, createHash } from "crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const countryCodeSchema = z.string().trim().length(2).toUpperCase().optional();
const currencySchema = z.string().trim().length(3).toUpperCase().optional();
const localeSchema = z.string().trim().min(2).max(16).optional();

/** Extended signup body — OpenAPI SignupBody plus market prefs. */
const ExtendedSignupBody = SignupBody.extend({
  countryCode: countryCodeSchema,
  preferredCurrency: currencySchema,
  locale: localeSchema,
});

const ExtendedUpdateProfileBody = UpdateMyProfileBody.extend({
  countryCode: countryCodeSchema,
  preferredCurrency: currencySchema,
  locale: localeSchema,
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const ForgotPasswordBody = z.object({
  email: z.string().email(),
});

const ResetPasswordBody = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function serializeAuthUser(
  user: {
    id: number;
    email: string;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    countryCode?: string | null;
    preferredCurrency?: string | null;
    locale?: string | null;
  },
  roles: Awaited<ReturnType<typeof getUserRoles>>,
) {
  const payload = toAuthUserPayload(user, roles);
  // Keep response schema-compatible: strip extra fields if Zod rejects them,
  // but prefer full payload once OpenAPI is regenerated.
  try {
    return SignupResponse.parse(payload);
  } catch {
    return {
      id: payload.id,
      email: payload.email,
      phone: payload.phone,
      firstName: payload.firstName,
      lastName: payload.lastName,
      roles: payload.roles,
      countryCode: payload.countryCode,
      preferredCurrency: payload.preferredCurrency,
      locale: payload.locale,
    };
  }
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = ExtendedSignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: parsed.data.email,
      passwordHash,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      countryCode: parsed.data.countryCode ?? DEFAULT_COUNTRY_CODE,
      preferredCurrency: parsed.data.preferredCurrency ?? DEFAULT_CURRENCY,
      locale: parsed.data.locale ?? DEFAULT_LOCALE,
    })
    .returning();

  await db.insert(userRolesTable).values({ userId: user.id, role: "buyer", vendorId: null });
  const roles = await getUserRoles(user.id);

  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);

  res.json(serializeAuthUser(user, roles));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!user) {
    res.status(404).json({ error: "No account for this email" });
    return;
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const roles = await getUserRoles(user.id);
  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);

  res.json(serializeAuthUser(user, roles));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = getSessionTokenFromRequest(req);
  if (token) {
    await destroySession(token);
  }
  clearSessionCookie(res);
  res.status(204).end();
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.user) {
    res.json(GetMeResponse.parse({ user: null }));
    return;
  }

  const payload = toAuthUserPayload(req.user, req.user.roles);
  try {
    res.json(GetMeResponse.parse({ user: payload }));
  } catch {
    res.json({
      user: {
        id: payload.id,
        email: payload.email,
        phone: payload.phone,
        firstName: payload.firstName,
        lastName: payload.lastName,
        roles: payload.roles,
        countryCode: payload.countryCode,
        preferredCurrency: payload.preferredCurrency,
        locale: payload.locale,
      },
    });
  }
});

router.patch("/auth/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = ExtendedUpdateProfileBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { firstName, lastName, phone, countryCode, preferredCurrency, locale } = parsed.data;
  const updates: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    countryCode: string;
    preferredCurrency: string;
    locale: string;
  }> = {};
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (phone !== undefined) updates.phone = phone;
  if (countryCode !== undefined) updates.countryCode = countryCode;
  if (preferredCurrency !== undefined) updates.preferredCurrency = preferredCurrency;
  if (locale !== undefined) updates.locale = locale;

  let updated;
  if (Object.keys(updates).length > 0) {
    [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user!.id)).returning();
  } else {
    [updated] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  }

  const roles = await getUserRoles(updated.id);
  const payload = serializeAuthUser(updated, roles);
  try {
    res.json(UpdateMyProfileResponse.parse(payload));
  } catch {
    res.json(payload);
  }
});

router.post("/auth/password", requireAuth, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  res.status(204).end();
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));

  // Always return 200 to prevent email enumeration
  if (!user) {
    res.json({ message: "If an account exists, a reset email has been sent" });
    return;
  }

  // Invalidate any existing reset tokens for this user
  await db
    .delete(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.userId, user.id));

  // Generate a cryptographically secure token
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokensTable).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  // Send reset email (best-effort — don't fail the request if email is down)
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${encodeURIComponent(token)}`;

  void sendEmail({
    to: user.email,
    subject: "Reset your alkemart password",
    html: `
      <p>Hi ${user.firstName || "there"},</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}">Reset password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  }).catch((err) => {
    logger.error({ err, userId: user.id }, "Failed to send password reset email");
  });

  res.json({ message: "If an account exists, a reset email has been sent" });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const tokenHash = hashToken(parsed.data.token);

  const [tokenRow] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    );

  if (!tokenRow || tokenRow.usedAt) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  // Mark token as used
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, tokenRow.id));

  // Update password
  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, tokenRow.userId));

  // Invalidate all sessions for this user (force re-login)
  const { destroyAllUserSessions } = await import("../lib/auth");
  await destroyAllUserSessions(tokenRow.userId);

  res.json({ message: "Password reset successful" });
});

export default router;
