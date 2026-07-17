import { and, eq, inArray } from "drizzle-orm";
import { db, cartsTable, cartItemsTable, productsTable } from "@workspace/db";

export async function getOrCreateCart(sessionKey: string) {
  const [existing] = await db.select().from(cartsTable).where(eq(cartsTable.sessionKey, sessionKey));
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(cartsTable)
    .values({ sessionKey })
    .onConflictDoNothing({ target: cartsTable.sessionKey })
    .returning();
  if (created) {
    return created;
  }

  const [afterConflict] = await db.select().from(cartsTable).where(eq(cartsTable.sessionKey, sessionKey));
  return afterConflict;
}

/**
 * Serialise a cart for API responses. Only returns items whose product is
 * currently active — inactive products are omitted from the result without
 * deleting them from the cart (use `cleanInactiveCartItems` for that).
 */
export async function serializeCart(cartId: number) {
  const rows = await db
    .select({
      id: cartItemsTable.id,
      productId: cartItemsTable.productId,
      qty: cartItemsTable.qty,
      product: productsTable,
    })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(productsTable.id, cartItemsTable.productId))
    .where(and(eq(cartItemsTable.cartId, cartId), eq(productsTable.isActive, true)));

  const subtotalPesewas = rows.reduce((sum, row) => sum + row.product.pricePesewas * row.qty, 0);

  return {
    id: cartId,
    items: rows,
    subtotalPesewas,
  };
}

/**
 * Removes cart line items whose product is inactive (soft-deleted or hidden).
 * Returns the list of removed items so the caller can notify the buyer.
 * Call this on GET /cart so stale items are flushed before the buyer sees
 * the cart; other mutating routes (add/update/remove) don't need it because
 * they either create items fresh or operate on existing item IDs.
 */
export async function cleanInactiveCartItems(cartId: number): Promise<{ id: number; title: string }[]> {
  const inactive = await db
    .select({ id: cartItemsTable.id, title: productsTable.title })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(productsTable.id, cartItemsTable.productId))
    .where(and(eq(cartItemsTable.cartId, cartId), eq(productsTable.isActive, false)));

  if (inactive.length > 0) {
    await db.delete(cartItemsTable).where(inArray(cartItemsTable.id, inactive.map((i) => i.id)));
  }

  return inactive;
}

export async function findCartItem(cartId: number, productId: number) {
  const [item] = await db
    .select()
    .from(cartItemsTable)
    .where(and(eq(cartItemsTable.cartId, cartId), eq(cartItemsTable.productId, productId)));
  return item;
}
