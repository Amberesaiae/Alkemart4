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
import { getOrCreateCart, serializeCart, findCartItem, cleanInactiveCartItems } from "../lib/cart";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/cart", async (req, res): Promise<void> => {
  try {
    const cart = await getOrCreateCart(req.cartSessionKey);
    // Flush any line items whose product has been deactivated or soft-deleted
    // before serialising — this keeps the buyer's cart consistent and prevents
    // stale items from reaching the checkout step.
    const removedItems = await cleanInactiveCartItems(cart.id);
    const summary = await serializeCart(cart.id);
    // `removedItems` is appended outside the schema so the validated cart
    // shape is preserved while the frontend can show a "removed" toast.
    res.json({ ...GetCartResponse.parse(summary), removedItems });
  } catch (err) {
    logger.error({ err }, "GET /cart failed");
    res.status(500).json({ error: "Failed to load cart. Please try again." });
  }
});

router.post("/cart/items", async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    logger.error({ err }, "POST /cart/items failed");
    res.status(500).json({ error: "Failed to add item to cart. Please try again." });
  }
});

router.patch("/cart/items/:id", async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    logger.error({ err }, "PATCH /cart/items/:id failed");
    res.status(500).json({ error: "Failed to update cart item. Please try again." });
  }
});

router.delete("/cart/items/:id", async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    logger.error({ err }, "DELETE /cart/items/:id failed");
    res.status(500).json({ error: "Failed to remove cart item. Please try again." });
  }
});

export default router;
