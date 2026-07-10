import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, addressesTable } from "@workspace/db";
import {
  ListMyAddressesResponse,
  CreateMyAddressBody,
  CreateMyAddressResponse,
  UpdateMyAddressParams,
  UpdateMyAddressBody,
  UpdateMyAddressResponse,
  DeleteMyAddressParams,
  SetDefaultMyAddressParams,
  SetDefaultMyAddressResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth-session";

const router: IRouter = Router();

router.get("/addresses", requireAuth, async (req, res): Promise<void> => {
  const items = await db
    .select()
    .from(addressesTable)
    .where(eq(addressesTable.buyerUserId, req.user!.id))
    .orderBy(desc(addressesTable.isDefault), desc(addressesTable.createdAt));
  res.json(ListMyAddressesResponse.parse({ items, total: items.length }));
});

router.post("/addresses", requireAuth, async (req, res): Promise<void> => {
  const body = CreateMyAddressBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: addressesTable.id })
      .from(addressesTable)
      .where(eq(addressesTable.buyerUserId, req.user!.id));
    // The buyer's very first address is always the default, regardless of
    // what they pass — there must never be zero default addresses once one
    // exists, since checkout and the account page both assume exactly one.
    const makeDefault = body.data.isDefault === true || !existing;

    if (makeDefault) {
      await tx
        .update(addressesTable)
        .set({ isDefault: false })
        .where(eq(addressesTable.buyerUserId, req.user!.id));
    }

    const [row] = await tx
      .insert(addressesTable)
      .values({ ...body.data, buyerUserId: req.user!.id, isDefault: makeDefault })
      .returning();
    return row;
  });

  res.json(CreateMyAddressResponse.parse(created));
});

router.patch("/addresses/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateMyAddressParams.safeParse(req.params);
  const body = UpdateMyAddressBody.safeParse(req.body ?? {});
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.error ?? body.error)!.message });
    return;
  }

  const [existing] = await db.select().from(addressesTable).where(eq(addressesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Address not found" });
    return;
  }
  if (existing.buyerUserId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    if (body.data.isDefault === true) {
      await tx.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.buyerUserId, req.user!.id));
    }
    const [row] = await tx
      .update(addressesTable)
      .set(body.data)
      .where(eq(addressesTable.id, params.data.id))
      .returning();
    return row;
  });

  res.json(UpdateMyAddressResponse.parse(updated));
});

router.delete("/addresses/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteMyAddressParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(addressesTable).where(eq(addressesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Address not found" });
    return;
  }
  if (existing.buyerUserId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    await db.delete(addressesTable).where(eq(addressesTable.id, params.data.id));
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause;
    if (cause?.code === "23503") {
      res.status(409).json({ error: "This address is used on an existing order and can't be deleted." });
      return;
    }
    throw error;
  }

  if (existing.isDefault) {
    const [nextDefault] = await db
      .select({ id: addressesTable.id })
      .from(addressesTable)
      .where(eq(addressesTable.buyerUserId, req.user!.id))
      .orderBy(desc(addressesTable.createdAt));
    if (nextDefault) {
      await db.update(addressesTable).set({ isDefault: true }).where(eq(addressesTable.id, nextDefault.id));
    }
  }

  res.status(204).send();
});

router.post("/addresses/:id/default", requireAuth, async (req, res): Promise<void> => {
  const params = SetDefaultMyAddressParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(addressesTable).where(eq(addressesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Address not found" });
    return;
  }
  if (existing.buyerUserId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    await tx.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.buyerUserId, req.user!.id));
    const [row] = await tx
      .update(addressesTable)
      .set({ isDefault: true })
      .where(and(eq(addressesTable.id, params.data.id)))
      .returning();
    return row;
  });

  res.json(SetDefaultMyAddressResponse.parse(updated));
});

export default router;
