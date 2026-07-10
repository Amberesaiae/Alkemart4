import { Router, type IRouter } from "express";
import { eq, desc, inArray, sql } from "drizzle-orm";
import {
  db,
  vendorsTable,
  disputesTable,
  userRolesTable,
  ordersTable,
  orderItemsTable,
  fulfillmentsTable,
  orderPaymentEventsTable,
} from "@workspace/db";
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

router.get("/admin/vendors", requireAbility("manage", "AdminPanel"), async (_req, res): Promise<void> => {
  const vendors = await db.select().from(vendorsTable).orderBy(vendorsTable.name);
  const owners = await db
    .select({ vendorId: userRolesTable.vendorId, userId: userRolesTable.userId })
    .from(userRolesTable)
    .where(eq(userRolesTable.role, "vendor_owner"));
  const ownerByVendor = new Map(owners.filter((o) => o.vendorId != null).map((o) => [o.vendorId as number, o.userId]));
  const items = vendors.map((v) => ({ ...v, ownerUserId: ownerByVendor.get(v.id) ?? null }));
  res.json(ListAdminVendorsResponse.parse({ items, total: items.length }));
});

router.patch("/admin/vendors/:id", requireAbility("manage", "AdminPanel"), async (req, res): Promise<void> => {
  const params = UpdateAdminVendorStatusParams.safeParse(req.params);
  const body = UpdateAdminVendorStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.error ?? body.error)?.message });
    return;
  }

  const [updated] = await db
    .update(vendorsTable)
    .set({ status: body.data.status })
    .where(eq(vendorsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  res.json(UpdateAdminVendorStatusResponse.parse(updated));
});

router.get("/admin/disputes", requireAbility("manage", "AdminPanel"), async (_req, res): Promise<void> => {
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

router.patch("/admin/disputes/:id", requireAbility("manage", "AdminPanel"), async (req, res): Promise<void> => {
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

router.get("/admin/analytics", requireAbility("manage", "AdminPanel"), async (_req, res): Promise<void> => {
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

export default router;
