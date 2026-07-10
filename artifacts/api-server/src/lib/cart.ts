import { eq, and } from "drizzle-orm";
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
    .where(eq(cartItemsTable.cartId, cartId));

  const subtotalPesewas = rows.reduce((sum, row) => sum + row.product.pricePesewas * row.qty, 0);

  return {
    id: cartId,
    items: rows,
    subtotalPesewas,
  };
}

export async function findCartItem(cartId: number, productId: number) {
  const [item] = await db
    .select()
    .from(cartItemsTable)
    .where(and(eq(cartItemsTable.cartId, cartId), eq(cartItemsTable.productId, productId)));
  return item;
}
