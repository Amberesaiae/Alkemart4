import { Router, type IRouter } from "express";
import { and, desc, eq, sql, inArray } from "drizzle-orm";
import {
  db,
  fulfillmentsTable,
  orderItemsTable,
  ordersTable,
  vendorSettlementsTable,
  vendorSettlementLinesTable,
  vendorsTable,
} from "@workspace/db";
import { requireAbility } from "../middlewares/auth-session";
import { isAdmin } from "@workspace/abilities";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * GET /admin/settlements — list settlements with optional status filter.
 */
router.get("/admin/settlements", requireAbility("manage", "Payout"), async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const where = status ? eq(vendorSettlementsTable.status, status as any) : undefined;

  const settlements = await db
    .select()
    .from(vendorSettlementsTable)
    .where(where)
    .orderBy(desc(vendorSettlementsTable.createdAt));

  res.json({ items: settlements, total: settlements.length });
});

/**
 * GET /vendor/settlements — vendor-scoped settlements.
 */
router.get("/vendor/settlements", requireAbility("read", "Payout"), async (req, res): Promise<void> => {
  const vendorIds = req.user!.roles
    .filter((r) => r.role === "vendor_owner" || r.role === "vendor_staff")
    .map((r) => r.vendorId)
    .filter((id): id is number => id != null);

  if (vendorIds.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }

  const settlements = await db
    .select()
    .from(vendorSettlementsTable)
    .where(inArray(vendorSettlementsTable.vendorId, vendorIds))
    .orderBy(desc(vendorSettlementsTable.createdAt));

  res.json({ items: settlements, total: settlements.length });
});

/**
 * POST /admin/settlements/generate — generate settlement for a vendor+period.
 * Idempotent: unique on (vendorId, periodStart, periodEnd).
 */
router.post("/admin/settlements/generate", requireAbility("manage", "Payout"), async (req, res): Promise<void> => {
  if (!isAdmin(req.user!.roles)) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const { vendorId, periodStart, periodEnd } = req.body ?? {};
  if (!vendorId || !periodStart || !periodEnd) {
    res.status(400).json({ error: "vendorId, periodStart, periodEnd are required" });
    return;
  }

  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    res.status(400).json({ error: "Invalid period dates" });
    return;
  }

  // Find delivered order items for this vendor in the period.
  const lines = await db
    .select({
      orderItemId: orderItemsTable.id,
      orderId: orderItemsTable.orderId,
      itemSubtotalPesewas: orderItemsTable.subtotalPesewas,
      commissionBps: vendorsTable.commissionBps,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .innerJoin(
      fulfillmentsTable,
      and(
        eq(fulfillmentsTable.orderId, orderItemsTable.orderId),
        eq(fulfillmentsTable.vendorId, orderItemsTable.vendorId),
        eq(fulfillmentsTable.status, "delivered"),
      ),
    )
    .innerJoin(vendorsTable, eq(vendorsTable.id, orderItemsTable.vendorId))
    .where(
      and(
        eq(orderItemsTable.vendorId, vendorId),
        sql`${ordersTable.createdAt} >= ${start}`,
        sql`${ordersTable.createdAt} < ${end}`,
        sql`${ordersTable.status} != 'cancelled'`,
      ),
    );

  if (lines.length === 0) {
    res.json({ message: "No deliverable items found for this period", settlement: null });
    return;
  }

  // Check if settlement already exists (idempotent).
  const [existing] = await db
    .select()
    .from(vendorSettlementsTable)
    .where(
      and(
        eq(vendorSettlementsTable.vendorId, vendorId),
        eq(vendorSettlementsTable.periodStart, start),
        eq(vendorSettlementsTable.periodEnd, end),
      ),
    );

  if (existing) {
    res.json({ message: "Settlement already exists", settlement: existing });
    return;
  }

  // Calculate totals.
  const grossPesewas = lines.reduce((sum, l) => sum + l.itemSubtotalPesewas, 0);
  const commissionPesewas = lines.reduce((sum, l) => sum + Math.floor((l.itemSubtotalPesewas * l.commissionBps) / 10_000), 0);
  const netPesewas = grossPesewas - commissionPesewas;

  // Use the first line's commission Bps as the snapshot (all should be same vendor).
  const commissionBpsSnapshot = lines[0].commissionBps;

  const settlement = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(vendorSettlementsTable)
      .values({
        vendorId,
        periodStart: start,
        periodEnd: end,
        grossPesewas,
        commissionPesewas,
        netPesewas,
        status: "ready",
      })
      .returning();

    await tx.insert(vendorSettlementLinesTable).values(
      lines.map((l) => ({
        settlementId: created.id,
        orderItemId: l.orderItemId,
        orderId: l.orderId,
        itemSubtotalPesewas: l.itemSubtotalPesewas,
        commissionBpsSnapshot,
        commissionPesewas: Math.floor((l.itemSubtotalPesewas * commissionBpsSnapshot) / 10_000),
        netPesewas: l.itemSubtotalPesewas - Math.floor((l.itemSubtotalPesewas * commissionBpsSnapshot) / 10_000),
      })),
    );

    return created;
  });

  logger.info({ settlementId: settlement.id, vendorId, grossPesewas, netPesewas }, "Settlement generated");
  res.json({ settlement });
});

/**
 * POST /admin/settlements/:id/mark-paid — admin marks a settlement as paid.
 */
router.post("/admin/settlements/:id/mark-paid", requireAbility("manage", "Payout"), async (req, res): Promise<void> => {
  if (!isAdmin(req.user!.roles)) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid settlement ID" });
    return;
  }

  const [settlement] = await db
    .select()
    .from(vendorSettlementsTable)
    .where(eq(vendorSettlementsTable.id, id));

  if (!settlement) {
    res.status(404).json({ error: "Settlement not found" });
    return;
  }

  if (settlement.status === "paid") {
    res.status(409).json({ error: "Settlement already marked as paid" });
    return;
  }

  if (settlement.status === "void") {
    res.status(409).json({ error: "Cannot mark a void settlement as paid" });
    return;
  }

  const [updated] = await db
    .update(vendorSettlementsTable)
    .set({
      status: "paid",
      paidAt: new Date(),
      paidByUserId: req.user!.id,
      note: req.body?.note ?? null,
    })
    .where(eq(vendorSettlementsTable.id, id))
    .returning();

  logger.info({ settlementId: id, vendorId: settlement.vendorId }, "Settlement marked as paid");
  res.json({ settlement: updated });
});

export default router;
