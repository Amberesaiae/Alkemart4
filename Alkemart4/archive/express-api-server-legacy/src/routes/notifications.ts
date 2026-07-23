import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { ListMyNotificationsResponse, MarkNotificationReadParams, MarkNotificationReadResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth-session";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const items = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.user!.id))
    .orderBy(desc(notificationsTable.createdAt));

  res.json(ListMyNotificationsResponse.parse({ items, total: items.length }));
});

router.post("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [notification] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, params.data.id));
  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  if (notification.userId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, notification.id), eq(notificationsTable.userId, req.user!.id)))
    .returning();

  res.json(MarkNotificationReadResponse.parse(updated));
});

export default router;
