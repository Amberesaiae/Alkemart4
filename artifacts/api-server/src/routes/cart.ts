import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, cartItemsTable, productsTable } from "@workspace/db";
import {
  GetCartResponse,
  AddCartItemBody,
  AddCartItemResponse,
  UpdateCartItemParams,
  UpdateCartItemBody,
  UpdateCartItemResponse,
  RemoveCartItemParams,
  RemoveCartItemResponse,
} from "@workspace/api-zod";
import { getOrCreateCart, serializeCart, findCartItem } from "../lib/cart";

const router: IRouter = Router();

router.get("/cart", async (req, res): Promise<void> => {
  const cart = await getOrCreateCart(req.cartSessionKey);
  const summary = await serializeCart(cart.id);
  res.json(GetCartResponse.parse(summary));
});

router.post("/cart/items", async (req, res): Promise<void> => {
  const parsed = AddCartItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
  if (!product || !product.isActive) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const cart = await getOrCreateCart(req.cartSessionKey);
  const existing = await findCartItem(cart.id, parsed.data.productId);

  if (existing) {
    await db
      .update(cartItemsTable)
      .set({ qty: existing.qty + parsed.data.qty })
      .where(eq(cartItemsTable.id, existing.id));
  } else {
    await db.insert(cartItemsTable).values({
      cartId: cart.id,
      productId: parsed.data.productId,
      qty: parsed.data.qty,
    });
  }

  const summary = await serializeCart(cart.id);
  res.json(AddCartItemResponse.parse(summary));
});

router.patch("/cart/items/:id", async (req, res): Promise<void> => {
  const params = UpdateCartItemParams.safeParse(req.params);
  const body = UpdateCartItemBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.error ?? body.error)?.message });
    return;
  }

  const cart = await getOrCreateCart(req.cartSessionKey);
  const [item] = await db.select().from(cartItemsTable).where(eq(cartItemsTable.id, params.data.id));
  if (!item || item.cartId !== cart.id) {
    res.status(404).json({ error: "Cart item not found" });
    return;
  }

  await db.update(cartItemsTable).set({ qty: body.data.qty }).where(eq(cartItemsTable.id, params.data.id));

  const summary = await serializeCart(cart.id);
  res.json(UpdateCartItemResponse.parse(summary));
});

router.delete("/cart/items/:id", async (req, res): Promise<void> => {
  const params = RemoveCartItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const cart = await getOrCreateCart(req.cartSessionKey);
  const [item] = await db.select().from(cartItemsTable).where(eq(cartItemsTable.id, params.data.id));
  if (!item || item.cartId !== cart.id) {
    res.status(404).json({ error: "Cart item not found" });
    return;
  }

  await db.delete(cartItemsTable).where(eq(cartItemsTable.id, params.data.id));

  const summary = await serializeCart(cart.id);
  res.json(RemoveCartItemResponse.parse(summary));
});

export default router;
