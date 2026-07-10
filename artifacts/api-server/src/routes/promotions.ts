import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, promotionsTable } from "@workspace/db";
import {
  ListAdminPromotionsResponse,
  CreateAdminPromotionBody,
  CreateAdminPromotionResponse,
  UpdateAdminPromotionParams,
  UpdateAdminPromotionBody,
  UpdateAdminPromotionResponse,
  DeleteAdminPromotionParams,
} from "@workspace/api-zod";
import { requireAbility } from "../middlewares/auth-session";

const router: IRouter = Router();

router.get("/admin/promotions", requireAbility("manage", "AdminPanel"), async (_req, res): Promise<void> => {
  const items = await db.select().from(promotionsTable).orderBy(desc(promotionsTable.createdAt));
  res.json(ListAdminPromotionsResponse.parse({ items, total: items.length }));
});

router.post("/admin/promotions", requireAbility("manage", "AdminPanel"), async (req, res): Promise<void> => {
  const body = CreateAdminPromotionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db.select({ id: promotionsTable.id }).from(promotionsTable).where(eq(promotionsTable.code, body.data.code));
  if (existing) {
    res.status(409).json({ error: `A promotion with code "${body.data.code}" already exists` });
    return;
  }

  const [created] = await db
    .insert(promotionsTable)
    .values({
      code: body.data.code,
      discountType: body.data.discountType,
      value: body.data.value,
      startsAt: body.data.startsAt ? new Date(body.data.startsAt) : null,
      endsAt: body.data.endsAt ? new Date(body.data.endsAt) : null,
      minOrderPesewas: body.data.minOrderPesewas ?? null,
      usageLimit: body.data.usageLimit ?? null,
    })
    .returning();

  res.json(CreateAdminPromotionResponse.parse(created));
});

router.patch("/admin/promotions/:id", requireAbility("manage", "AdminPanel"), async (req, res): Promise<void> => {
  const params = UpdateAdminPromotionParams.safeParse(req.params);
  const body = UpdateAdminPromotionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.error ?? body.error)?.message });
    return;
  }

  const [promotion] = await db.select().from(promotionsTable).where(eq(promotionsTable.id, params.data.id));
  if (!promotion) {
    res.status(404).json({ error: "Promotion not found" });
    return;
  }

  const [updated] = await db
    .update(promotionsTable)
    .set({
      ...(body.data.isActive !== undefined ? { isActive: body.data.isActive } : {}),
      ...(body.data.endsAt !== undefined ? { endsAt: body.data.endsAt ? new Date(body.data.endsAt) : null } : {}),
      ...(body.data.minOrderPesewas !== undefined ? { minOrderPesewas: body.data.minOrderPesewas } : {}),
      ...(body.data.usageLimit !== undefined ? { usageLimit: body.data.usageLimit } : {}),
    })
    .where(eq(promotionsTable.id, promotion.id))
    .returning();

  res.json(UpdateAdminPromotionResponse.parse(updated));
});

router.delete("/admin/promotions/:id", requireAbility("manage", "AdminPanel"), async (req, res): Promise<void> => {
  const params = DeleteAdminPromotionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [promotion] = await db.select().from(promotionsTable).where(eq(promotionsTable.id, params.data.id));
  if (!promotion) {
    res.status(404).json({ error: "Promotion not found" });
    return;
  }

  await db.delete(promotionsTable).where(eq(promotionsTable.id, promotion.id));
  res.status(204).end();
});

export default router;
