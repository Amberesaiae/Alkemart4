import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, disputesTable, orderItemsTable, ordersTable } from "@workspace/db";
import { CreateMyDisputeBody, CreateMyDisputeResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth-session";

const router: IRouter = Router();

router.post("/disputes", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMyDisputeBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { orderId, subject, note } = parsed.data;

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.buyerUserId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (order.status !== "confirmed" && order.status !== "fulfilled") {
    res.status(409).json({ error: "Disputes can only be opened for confirmed or fulfilled orders" });
    return;
  }

  const [firstItem] = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const vendorId = firstItem?.vendorId ?? null;

  const [dispute] = await db
    .insert(disputesTable)
    .values({
      orderId,
      vendorId,
      buyerUserId: req.user!.id,
      subject,
      note: note ?? null,
      status: "open",
    })
    .returning();

  res.json(CreateMyDisputeResponse.parse(dispute));
});

export default router;
