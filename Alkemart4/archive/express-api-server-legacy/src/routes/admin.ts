import { Router, type IRouter } from "express";
import { eq, desc, inArray, sql } from "drizzle-orm";
import {
  db,
  vendorsTable,
  disputesTable,
  userRolesTable,
  usersTable,
  ordersTable,
  orderItemsTable,
  fulfillmentsTable,
  orderPaymentEventsTable,
} from "@workspace/db";
import { isAdmin, ROLES, type Role } from "@workspace/abilities";
import { z } from "zod";
import {
  ListAdminVendorsResponse,
  UpdateAdminVendorStatusParams,
  UpdateAdminVendorStatusBody,
  UpdateAdminVendorStatusResponse,
  ListAdminDisputesResponse,
  UpdateAdminDisputeParams,
  UpdateAdminDisputeBody,
  UpdateAdminDisputeResponse,
  GetAdminAnalyticsResponse,
} from "@workspace/api-zod";
import { requireAbility } from "../middlewares/auth-session";

const router: IRouter = Router();

router.get("/admin/vendors", requireAbility("read", "AdminPanel"), async (_req, res): Promise<void> => {
  const vendors = await db.select().from(vendorsTable).orderBy(vendorsTable.name);
  const owners = await db
    .select({ vendorId: userRolesTable.vendorId, userId: userRolesTable.userId })
    .from(userRolesTable)
    .where(eq(userRolesTable.role, "vendor_owner"));
  const ownerByVendor = new Map(owners.filter((o) => o.vendorId != null).map((o) => [o.vendorId as number, o.userId]));
  const items = vendors.map((v) => ({ ...v, ownerUserId: ownerByVendor.get(v.id) ?? null }));
  res.json(ListAdminVendorsResponse.parse({ items, total: items.length }));
});

router.patch("/admin/vendors/:id", requireAbility("read", "AdminPanel"), async (req, res): Promise<void> => {
  // Vendor status mutations are admin-only; support agents can view but not
  // change vendor records even though they can enter the admin panel.
  if (!isAdmin(req.user!.roles)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const params = UpdateAdminVendorStatusParams.safeParse(req.params);
  const body = UpdateAdminVendorStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.error ?? body.error)?.message });
    return;
  }

  const updates: { status?: "active" | "suspended"; commissionBps?: number } = {};
  if (body.data.status !== undefined) updates.status = body.data.status;
  if (body.data.commissionBps !== undefined) updates.commissionBps = body.data.commissionBps;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Provide status and/or commissionBps" });
    return;
  }

  const [updated] = await db
    .update(vendorsTable)
    .set(updates)
    .where(eq(vendorsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  res.json(UpdateAdminVendorStatusResponse.parse(updated));
});

router.get("/admin/disputes", requireAbility("read", "AdminPanel"), async (_req, res): Promise<void> => {
  const disputes = await db.select().from(disputesTable).orderBy(desc(disputesTable.createdAt));

  const orderIds = [...new Set(disputes.map((d) => d.orderId))];
  const [orders, items, fulfillments, paymentEvents] = orderIds.length
    ? await Promise.all([
        db.select().from(ordersTable).where(inArray(ordersTable.id, orderIds)),
        db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds)),
        db.select().from(fulfillmentsTable).where(inArray(fulfillmentsTable.orderId, orderIds)),
        db.select().from(orderPaymentEventsTable).where(inArray(orderPaymentEventsTable.orderId, orderIds)),
      ])
    : [[], [], [], []];

  const orderById = new Map(orders.map((o) => [o.id, o]));
  const itemsByOrder = new Map<number, typeof items>();
  for (const item of items) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
  const fulfillmentsByOrder = new Map<number, typeof fulfillments>();
  for (const f of fulfillments) fulfillmentsByOrder.set(f.orderId, [...(fulfillmentsByOrder.get(f.orderId) ?? []), f]);
  const paymentEventsByOrder = new Map<number, typeof paymentEvents>();
  for (const e of paymentEvents) paymentEventsByOrder.set(e.orderId, [...(paymentEventsByOrder.get(e.orderId) ?? []), e]);

  const itemsResult = disputes.map((d) => {
    const order = orderById.get(d.orderId);
    return {
      ...d,
      order: order
        ? {
            id: order.id,
            status: order.status,
            totalPesewas: order.totalPesewas,
            paymentMethod: order.paymentMethod,
            items: itemsByOrder.get(order.id) ?? [],
            fulfillments: fulfillmentsByOrder.get(order.id) ?? [],
            paymentEvents: paymentEventsByOrder.get(order.id) ?? [],
          }
        : null,
    };
  });

  res.json(ListAdminDisputesResponse.parse({ items: itemsResult, total: itemsResult.length }));
});

router.patch("/admin/disputes/:id", requireAbility("manage", "Dispute"), async (req, res): Promise<void> => {
  const params = UpdateAdminDisputeParams.safeParse(req.params);
  const body = UpdateAdminDisputeBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.error ?? body.error)?.message });
    return;
  }
  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(disputesTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(disputesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Dispute not found" });
    return;
  }

  res.json(UpdateAdminDisputeResponse.parse(updated));
});

// Revenue is counted for confirmed + fulfilled orders (i.e. any order that
// actually charged/committed to a payment) — pending and cancelled orders
// never counted revenue.
const REVENUE_STATUSES = ["confirmed", "fulfilled"] as const;

router.get("/admin/analytics", requireAbility("read", "AdminPanel"), async (_req, res): Promise<void> => {
  const [revenueSeries, orderStatusBreakdown, topVendors, fulfillmentStatusBreakdown, disputeCounts] = await Promise.all([
    db
      .select({
        date: sql<string>`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`,
        revenuePesewas: sql<number>`coalesce(sum(${ordersTable.totalPesewas}), 0)::int`,
        orderCount: sql<number>`count(*)::int`,
      })
      .from(ordersTable)
      .where(inArray(ordersTable.status, REVENUE_STATUSES))
      .groupBy(sql`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`),
    db
      .select({ status: ordersTable.status, count: sql<number>`count(*)::int` })
      .from(ordersTable)
      .groupBy(ordersTable.status),
    db
      .select({
        vendorId: orderItemsTable.vendorId,
        name: vendorsTable.name,
        revenuePesewas: sql<number>`coalesce(sum(${orderItemsTable.subtotalPesewas}), 0)::int`,
        orderCount: sql<number>`count(distinct ${orderItemsTable.orderId})::int`,
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .innerJoin(vendorsTable, eq(orderItemsTable.vendorId, vendorsTable.id))
      .where(inArray(ordersTable.status, REVENUE_STATUSES))
      .groupBy(orderItemsTable.vendorId, vendorsTable.name)
      .orderBy(sql`coalesce(sum(${orderItemsTable.subtotalPesewas}), 0) desc`)
      .limit(10),
    db
      .select({ status: fulfillmentsTable.status, count: sql<number>`count(*)::int` })
      .from(fulfillmentsTable)
      .groupBy(fulfillmentsTable.status),
    db
      .select({
        openCount: sql<number>`count(*) filter (where ${disputesTable.status} <> 'resolved')::int`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(disputesTable),
  ]);

  res.json(
    GetAdminAnalyticsResponse.parse({
      revenueSeries,
      orderStatusBreakdown,
      topVendors,
      fulfillmentStatusBreakdown,
      openDisputeCount: disputeCounts[0]?.openCount ?? 0,
      totalDisputeCount: disputeCounts[0]?.totalCount ?? 0,
    }),
  );
});

// ─── User / role administration (admin only) ───────────────────────────────

const AssignRoleBody = z.object({
  email: z.string().email(),
  role: z.enum(ROLES as unknown as [Role, ...Role[]]),
  vendorId: z.number().int().positive().nullable().optional(),
});

const RevokeRoleBody = z.object({
  role: z.enum(ROLES as unknown as [Role, ...Role[]]),
  vendorId: z.number().int().positive().nullable().optional(),
});

router.get("/admin/users", requireAbility("manage", "AdminPanel"), async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(usersTable)
    .orderBy(usersTable.id)
    .limit(200);

  const userIds = users.map((u) => u.id);
  const roles =
    userIds.length === 0
      ? []
      : await db.select().from(userRolesTable).where(inArray(userRolesTable.userId, userIds));

  const rolesByUser = new Map<number, { role: string; vendorId: number | null }[]>();
  for (const r of roles) {
    const list = rolesByUser.get(r.userId) ?? [];
    list.push({ role: r.role, vendorId: r.vendorId });
    rolesByUser.set(r.userId, list);
  }

  const items = users.map((u) => ({
    ...u,
    roles: rolesByUser.get(u.id) ?? [],
  }));

  res.json({ items, total: items.length });
});

router.post("/admin/users/roles", requireAbility("manage", "AdminPanel"), async (req, res): Promise<void> => {
  if (!isAdmin(req.user!.roles)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = AssignRoleBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { email, role, vendorId } = body.data;
  const needsVendor = role === "vendor_owner" || role === "vendor_staff";
  if (needsVendor && (vendorId == null || vendorId <= 0)) {
    res.status(400).json({ error: "vendorId is required for vendor roles" });
    return;
  }
  if (!needsVendor && vendorId != null) {
    res.status(400).json({ error: "vendorId must be null for non-vendor roles" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.status(404).json({ error: "No user with that email" });
    return;
  }

  if (needsVendor && vendorId != null) {
    const [vendor] = await db.select({ id: vendorsTable.id }).from(vendorsTable).where(eq(vendorsTable.id, vendorId));
    if (!vendor) {
      res.status(404).json({ error: "Vendor not found" });
      return;
    }
  }

  await db
    .insert(userRolesTable)
    .values({
      userId: user.id,
      role,
      vendorId: needsVendor ? vendorId! : null,
    })
    .onConflictDoNothing();

  const roleRows = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, user.id));
  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: roleRows.map((r) => ({ role: r.role, vendorId: r.vendorId })),
  });
});

router.delete("/admin/users/:id/roles", requireAbility("manage", "AdminPanel"), async (req, res): Promise<void> => {
  if (!isAdmin(req.user!.roles)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const userId = Number(req.params.id);
  if (!Number.isFinite(userId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const body = RevokeRoleBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { role, vendorId } = body.data;
  const rows = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId));
  const match = rows.find(
    (r) => r.role === role && (vendorId == null ? r.vendorId == null : r.vendorId === vendorId),
  );
  if (!match) {
    res.status(404).json({ error: "Role assignment not found" });
    return;
  }

  // Prevent removing the last admin role from yourself by accident if you're the only admin
  if (role === "admin" && userId === req.user!.id) {
    const adminCount = (
      await db.select({ id: userRolesTable.id }).from(userRolesTable).where(eq(userRolesTable.role, "admin"))
    ).length;
    if (adminCount <= 1) {
      res.status(400).json({ error: "Cannot revoke the last admin role" });
      return;
    }
  }

  await db.delete(userRolesTable).where(eq(userRolesTable.id, match.id));
  res.status(204).end();
});

export default router;
