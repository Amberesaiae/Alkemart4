import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  categoriesTable,
  ordersTable,
  orderItemsTable,
  productsTable,
  sessionsTable,
  userRolesTable,
  usersTable,
  vendorsTable,
} from "@workspace/db";
import app from "../app";
import { hashPassword, createSession } from "../lib/auth";

/**
 * Regression coverage for DELETE /vendor/products/:id.
 *
 * Three cases:
 *   1. Hard-delete — product with no order history is fully removed (204, row gone).
 *   2. Soft-delete — product referenced by an order line item cannot be hard-deleted
 *      (FK violation) so the handler catches the error and sets isActive=false
 *      instead. Response is still 204, but the row survives.
 *   3. Cross-vendor authz — a vendor cannot delete another vendor's product (403).
 */
describe("vendor product delete", () => {
  const suffix = randomUUID().slice(0, 8);

  let categoryId: number;

  // vendor A — owns the products under test
  let vendorAId: number;
  let vendorAUserId: number;
  let vendorAToken: string;

  // vendor B — used for the cross-vendor 403 test
  let vendorBId: number;
  let vendorBUserId: number;
  let vendorBToken: string;

  // buyer — needed to satisfy the orders FK
  let buyerUserId: number;

  // IDs to clean up (in reverse FK dependency order)
  let hardDeleteProductId: number;
  let softDeleteProductId: number;
  let crossVendorProductId: number;
  let orderId: number;
  let orderItemId: number;

  beforeAll(async () => {
    // ── shared category ─────────────────────────────────────────────────────
    const [cat] = await db
      .insert(categoriesTable)
      .values({ slug: `del-cat-${suffix}`, name: "Delete Test Cat" })
      .returning();
    categoryId = cat!.id;

    // ── vendor A ─────────────────────────────────────────────────────────────
    const [vendorA] = await db
      .insert(vendorsTable)
      .values({ slug: `del-vendor-a-${suffix}`, name: "Delete Vendor A" })
      .returning();
    vendorAId = vendorA!.id;

    const [userA] = await db
      .insert(usersTable)
      .values({
        email: `del-vendor-a-${suffix}@example.com`,
        passwordHash: await hashPassword("Password123!"),
        firstName: "DeleteVendorA",
      })
      .returning();
    vendorAUserId = userA!.id;

    await db.insert(userRolesTable).values({ userId: vendorAUserId, role: "vendor_owner", vendorId: vendorAId });
    const { token: tokenA } = await createSession(vendorAUserId);
    vendorAToken = tokenA;

    // ── vendor B ─────────────────────────────────────────────────────────────
    const [vendorB] = await db
      .insert(vendorsTable)
      .values({ slug: `del-vendor-b-${suffix}`, name: "Delete Vendor B" })
      .returning();
    vendorBId = vendorB!.id;

    const [userB] = await db
      .insert(usersTable)
      .values({
        email: `del-vendor-b-${suffix}@example.com`,
        passwordHash: await hashPassword("Password123!"),
        firstName: "DeleteVendorB",
      })
      .returning();
    vendorBUserId = userB!.id;

    await db.insert(userRolesTable).values({ userId: vendorBUserId, role: "vendor_owner", vendorId: vendorBId });
    const { token: tokenB } = await createSession(vendorBUserId);
    vendorBToken = tokenB;

    // ── buyer (for order FK) ─────────────────────────────────────────────────
    const [buyer] = await db
      .insert(usersTable)
      .values({
        email: `del-buyer-${suffix}@example.com`,
        passwordHash: await hashPassword("Password123!"),
        firstName: "DeleteBuyer",
      })
      .returning();
    buyerUserId = buyer!.id;
    await db.insert(userRolesTable).values({ userId: buyerUserId, role: "buyer", vendorId: null });

    // ── product that will be hard-deleted (no orders) ────────────────────────
    const [pHard] = await db
      .insert(productsTable)
      .values({
        vendorId: vendorAId,
        categoryId,
        slug: `del-hard-${suffix}`,
        title: "Hard Delete Product",
        pricePesewas: 1000,
        stock: 5,
      })
      .returning();
    hardDeleteProductId = pHard!.id;

    // ── product that will be soft-deleted (referenced by an order) ───────────
    const [pSoft] = await db
      .insert(productsTable)
      .values({
        vendorId: vendorAId,
        categoryId,
        slug: `del-soft-${suffix}`,
        title: "Soft Delete Product",
        pricePesewas: 2000,
        stock: 10,
      })
      .returning();
    softDeleteProductId = pSoft!.id;

    // ── product owned by vendor A that vendor B will try to delete ───────────
    const [pCross] = await db
      .insert(productsTable)
      .values({
        vendorId: vendorAId,
        categoryId,
        slug: `del-cross-${suffix}`,
        title: "Cross Vendor Product",
        pricePesewas: 500,
        stock: 3,
      })
      .returning();
    crossVendorProductId = pCross!.id;

    // ── order that references softDeleteProductId ────────────────────────────
    const [order] = await db
      .insert(ordersTable)
      .values({
        buyerUserId,
        status: "confirmed",
        subtotalPesewas: 2000,
        totalPesewas: 2000,
        paymentMethod: "cash_on_delivery",
      })
      .returning();
    orderId = order!.id;

    const [item] = await db
      .insert(orderItemsTable)
      .values({
        orderId,
        productId: softDeleteProductId,
        vendorId: vendorAId,
        titleSnapshot: "Soft Delete Product",
        pricePesewasSnapshot: 2000,
        qty: 1,
        subtotalPesewas: 2000,
      })
      .returning();
    orderItemId = item!.id;
  });

  afterAll(async () => {
    // order_items → orders → products (cascade on order_items, but products
    // must be deleted/updated after order_items FK is removed)
    if (orderItemId) {
      await db.delete(orderItemsTable).where(eq(orderItemsTable.id, orderItemId));
    }
    if (orderId) {
      await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
    }

    // Products that may still be alive (soft-deleted, cross-vendor test product)
    const remainingProductIds = [softDeleteProductId, crossVendorProductId].filter(Boolean);
    if (remainingProductIds.length > 0) {
      // Re-activate before deleting to satisfy any potential cascade hooks,
      // then delete directly in the DB (bypassing the app's FK guard).
      await db.delete(productsTable).where(inArray(productsTable.id, remainingProductIds));
    }

    // Sessions & roles
    const userIds = [vendorAUserId, vendorBUserId, buyerUserId].filter(Boolean);
    if (userIds.length > 0) {
      await db.delete(sessionsTable).where(inArray(sessionsTable.userId, userIds));
      await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
      await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    }

    await db.delete(vendorsTable).where(inArray(vendorsTable.id, [vendorAId, vendorBId].filter(Boolean)));
    await db.delete(categoriesTable).where(eq(categoriesTable.id, categoryId));
  });

  // ── 1. Hard-delete ──────────────────────────────────────────────────────────
  it("hard-deletes a product with no order history (204, row gone)", async () => {
    const res = await request(app)
      .delete(`/api/vendor/products/${hardDeleteProductId}`)
      .set("Cookie", [`session_token=${vendorAToken}`]);

    expect(res.status).toBe(204);

    // Row must no longer exist in the DB
    const [row] = await db.select().from(productsTable).where(eq(productsTable.id, hardDeleteProductId));
    expect(row).toBeUndefined();
  });

  // ── 2. Soft-delete ─────────────────────────────────────────────────────────
  it("soft-deletes a product referenced by an order line item (204, isActive=false, row survives)", async () => {
    const res = await request(app)
      .delete(`/api/vendor/products/${softDeleteProductId}`)
      .set("Cookie", [`session_token=${vendorAToken}`]);

    expect(res.status).toBe(204);

    // Row must still exist (order history must keep pointing at a real row)
    const [row] = await db.select().from(productsTable).where(eq(productsTable.id, softDeleteProductId));
    expect(row).toBeDefined();
    // …but it must be deactivated so it disappears from the storefront
    expect(row!.isActive).toBe(false);
  });

  // ── 3. Cross-vendor authz ──────────────────────────────────────────────────
  it("returns 403 when vendor B tries to delete vendor A's product", async () => {
    const res = await request(app)
      .delete(`/api/vendor/products/${crossVendorProductId}`)
      .set("Cookie", [`session_token=${vendorBToken}`]);

    expect(res.status).toBe(403);

    // Product must be untouched
    const [row] = await db.select().from(productsTable).where(eq(productsTable.id, crossVendorProductId));
    expect(row).toBeDefined();
    expect(row!.isActive).toBe(true);
  });

  // ── 4. Unauthenticated ─────────────────────────────────────────────────────
  it("returns 401 when not authenticated", async () => {
    const res = await request(app).delete(`/api/vendor/products/${crossVendorProductId}`);
    expect(res.status).toBe(401);
  });

  // ── 5. Not found ───────────────────────────────────────────────────────────
  it("returns 404 when product does not exist", async () => {
    const res = await request(app)
      .delete("/api/vendor/products/999999999")
      .set("Cookie", [`session_token=${vendorAToken}`]);

    expect(res.status).toBe(404);
  });
});
