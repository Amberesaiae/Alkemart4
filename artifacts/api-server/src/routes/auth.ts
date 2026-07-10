import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, userRolesTable } from "@workspace/db";
import { SignupBody, SignupResponse, LoginBody, LoginResponse, GetMeResponse, UpdateMyProfileBody, UpdateMyProfileResponse } from "@workspace/api-zod";
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
} from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
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
    })
    .returning();

  await db.insert(userRolesTable).values({ userId: user.id, role: "buyer", vendorId: null });
  const roles = await getUserRoles(user.id);

  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);

  res.json(
    SignupResponse.parse({
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
    }),
  );
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

  res.json(
    LoginResponse.parse({
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
    }),
  );
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

  res.json(
    GetMeResponse.parse({
      user: {
        id: req.user.id,
        email: req.user.email,
        phone: req.user.phone,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        roles: req.user.roles,
      },
    }),
  );
});

router.patch("/auth/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { firstName, lastName, phone } = parsed.data;
  const updates: Partial<{ firstName: string; lastName: string; phone: string }> = {};
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (phone !== undefined) updates.phone = phone;

  let updated;
  if (Object.keys(updates).length > 0) {
    [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user!.id)).returning();
  } else {
    [updated] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  }

  const roles = await getUserRoles(updated.id);
  res.json(
    UpdateMyProfileResponse.parse({
      id: updated.id,
      email: updated.email,
      phone: updated.phone,
      firstName: updated.firstName,
      lastName: updated.lastName,
      roles,
    }),
  );
});

export default router;
