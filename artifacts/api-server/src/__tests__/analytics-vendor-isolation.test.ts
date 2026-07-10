import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import {
  db,
  addressesTable,
  categoriesTable,
  fulfillmentsTable,
  orderItemsTable,
  ordersTable,
  productsTable,
  sessionsTable,
  userRolesTable,
  usersTable,
  vendorsTable,
} from "@workspace/db";
import app from "../app";
import { hashPassword, createSession } from "../lib/auth";

/**
 * Regression coverage for task #21: vendor analytics (`GET /vendor/analytics`)
 * and admin analytics (`GET /admin/analytics`) must scope revenue/order/
 * product data strictly by vendorIdsFor(req.user.roles). Without this test a
 * future refactor of the analytics queries could silently leak one vendor's
 * revenue or products into another vendor's dashboard.
 */
describe("analytics vendor isolation", () => {
  const suffix = randomUUID().slice(0, 8);

  let categoryId: number;
  let vendorAId: number;
  let vendorBId: number;
  let productAId: number;
  let productBId: number;
  let buyerUserId: number;
  let vendorAUserId: number;
  let vendorBUserId: number;
  let adminUserId: number;
  let vendorASessionToken: string;
  let vendorBSessionToken: string;
  let adminSessionToken: string;
  const orderIds: number[] = [];

  beforeAll(async () => {
    const [category] = await db
      .insert(categoriesTable)
      .values({ slug: `analytics-iso-category-${suffix}`, name: "Analytics Isolation Category" })
      .returning();
    categoryId = category!.id;

    const [vendorA] = await db
      .insert(vendorsTable)
      .values({ slug: `analytics-iso-vendor-a-${suffix}`, name: "Analytics Isolation Vendor A" })
      .returning();
    vendorAId = vendorA!.id;

    const [vendorB] = await db
      .insert(vendorsTable)
      .values({ slug: `analytics-iso-vendor-b-${suffix}`, name: "Analytics Isolation Vendor B" })
      .returning();
    vendorBId = vendorB!.id;

    const [productA] = await db
      .insert(productsTable)
      .values({
        vendorId: vendorAId,
        categoryId,
        slug: `analytics-iso-product-a-${suffix}`,
        title: "Analytics Isolation Product A",
        pricePesewas: 1000,
        stock: 50,
      })
      .returning();
    productAId = productA!.id;

    const [productB] = await db
      .insert(productsTable)
      .values({
        vendorId: vendorBId,
        categoryId,
        slug: `analytics-iso-product-b-${suffix}`,
        title: "Analytics Isolation Product B",
        pricePesewas: 2000,
        stock: 50,
      })
      .returning();
    productBId = productB!.id;

    // A single buyer places orders against both vendors so we can exercise
    // cross-vendor scoping without needing a full checkout flow.
    const [buyer] = await db
      .insert(usersTable)
      .values({
        email: `analytics-iso-buyer-${suffix}@example.com`,
        passwordHash: await hashPassword("Password123!"),
        firstName: "Buyer",
      })
      .returning();
    buyerUserId = buyer!.id;
    await db.insert(addressesTable).values({
      buyerUserId,
      fullName: "Analytics Buyer",
      phone: "0551234987",
      line1: "1 Test Street",
      city: "Accra",
    });
    await db.insert(userRolesTable).values({ userId: buyerUserId, role: "buyer" });

    async function createOrder(opts: {
      vendorId: number;
      productId: number;
      titleSnapshot: string;
      pricePesewasSnapshot: number;
      status: "pending" | "confirmed" | "fulfilled" | "cancelled";
    }) {
      const subtotal = opts.pricePesewasSnapshot;
      const [order] = await db
        .insert(ordersTable)
        .values({
          buyerUserId,
          status: opts.status,
          subtotalPesewas: subtotal,
          totalPesewas: subtotal,
          paymentMethod: "cash_on_delivery",
        })
        .returning();
      await db.insert(orderItemsTable).values({
        orderId: order!.id,
        productId: opts.productId,
        vendorId: opts.vendorId,
        titleSnapshot: opts.titleSnapshot,
        pricePesewasSnapshot: opts.pricePesewasSnapshot,
        qty: 1,
        subtotalPesewas: subtotal,
      });
      await db.insert(fulfillmentsTable).values({ orderId: order!.id, vendorId: opts.vendorId });
      orderIds.push(order!.id);
      return order!.id;
    }

    // Vendor A: one confirmed (counts), one pending (must NOT count as revenue).
    await createOrder({
      vendorId: vendorAId,
      productId: productAId,
      titleSnapshot: "Analytics Isolation Product A",
      pricePesewasSnapshot: 1000,
      status: "confirmed",
    });
    await createOrder({
      vendorId: vendorAId,
      productId: productAId,
      titleSnapshot: "Analytics Isolation Product A",
      pricePesewasSnapshot: 1000,
      status: "pending",
    });

    // Vendor B: one fulfilled (counts), one cancelled (must NOT count as revenue).
    await createOrder({
      vendorId: vendorBId,
      productId: productBId,
      titleSnapshot: "Analytics Isolation Product B",
      pricePesewasSnapshot: 2000,
      status: "fulfilled",
    });
    await createOrder({
      vendorId: vendorBId,
      productId: productBId,
      titleSnapshot: "Analytics Isolation Product B",
      pricePesewasSnapshot: 2000,
      status: "cancelled",
    });

    async function createVendorUser(label: string, vendorId: number) {
      const [user] = await db
        .insert(usersTable)
        .values({
          email: `analytics-iso-${label}-${suffix}@example.com`,
          passwordHash: await hashPassword("Password123!"),
          firstName: label,
        })
        .returning();
      await db.insert(userRolesTable).values({ userId: user!.id, role: "vendor_owner", vendorId });
      const session = await createSession(user!.id);
      return { userId: user!.id, sessionToken: session.token };
    }

    const vendorAUser = await createVendorUser("vendor-a", vendorAId);
    vendorAUserId = vendorAUser.userId;
    vendorASessionToken = vendorAUser.sessionToken;

    const vendorBUser = await createVendorUser("vendor-b", vendorBId);
    vendorBUserId = vendorBUser.userId;
    vendorBSessionToken = vendorBUser.sessionToken;

    const [admin] = await db
      .insert(usersTable)
      .values({
        email: `analytics-iso-admin-${suffix}@example.com`,
        passwordHash: await hashPassword("Password123!"),
        firstName: "Admin",
      })
      .returning();
    adminUserId = admin!.id;
    await db.insert(userRolesTable).values({ userId: adminUserId, role: "admin" });
    const adminSession = await createSession(adminUserId);
    adminSessionToken = adminSession.token;
  });

  afterAll(async () => {
    for (const orderId of new Set(orderIds)) {
      await db.delete(fulfillmentsTable).where(eq(fulfillmentsTable.orderId, orderId));
      await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
      await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
    }
    for (const userId of [buyerUserId, vendorAUserId, vendorBUserId, adminUserId].filter(Boolean)) {
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
      await db.delete(userRolesTable).where(eq(userRolesTable.userId, userId));
    }
    if (buyerUserId) await db.delete(addressesTable).where(eq(addressesTable.buyerUserId, buyerUserId));
    for (const userId of [buyerUserId, vendorAUserId, vendorBUserId, adminUserId].filter(Boolean)) {
      await db.delete(usersTable).where(eq(usersTable.id, userId));
    }
    if (productAId) await db.delete(productsTable).where(eq(productsTable.id, productAId));
    if (productBId) await db.delete(productsTable).where(eq(productsTable.id, productBId));
    if (vendorAId) await db.delete(vendorsTable).where(eq(vendorsTable.id, vendorAId));
    if (vendorBId) await db.delete(vendorsTable).where(eq(vendorsTable.id, vendorBId));
    if (categoryId) await db.delete(categoriesTable).where(eq(categoriesTable.id, categoryId));
  });

  it("never shows vendor B's revenue, orders, or products in vendor A's analytics (and vice versa)", async () => {
    const [resA, resB] = await Promise.all([
      request(app).get("/api/vendor/analytics").set("Cookie", [`session_token=${vendorASessionToken}`]),
      request(app).get("/api/vendor/analytics").set("Cookie", [`session_token=${vendorBSessionToken}`]),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    // Vendor A must never see vendor B's product or its revenue, and vice versa.
    expect(resA.body.topProducts.map((p: { productId: number }) => p.productId)).not.toContain(productBId);
    expect(resB.body.topProducts.map((p: { productId: number }) => p.productId)).not.toContain(productAId);

    const totalRevenueA = resA.body.revenueSeries.reduce((sum: number, r: { revenuePesewas: number }) => sum + r.revenuePesewas, 0);
    const totalRevenueB = resB.body.revenueSeries.reduce((sum: number, r: { revenuePesewas: number }) => sum + r.revenuePesewas, 0);

    // Vendor A's only revenue-eligible order is the 1000-pesewas confirmed
    // order; the pending order must not contribute.
    expect(totalRevenueA).toBe(1000);
    // Vendor B's only revenue-eligible order is the 2000-pesewas fulfilled
    // order; the cancelled order must not contribute.
    expect(totalRevenueB).toBe(2000);

    // Vendor A's order-status breakdown must only reflect vendor A's own two
    // orders (confirmed + pending), never vendor B's (fulfilled + cancelled).
    const statusesA = resA.body.orderStatusBreakdown.map((s: { status: string }) => s.status).sort();
    expect(statusesA).toEqual(["confirmed", "pending"]);
    const statusesB = resB.body.orderStatusBreakdown.map((s: { status: string }) => s.status).sort();
    expect(statusesB).toEqual(["cancelled", "fulfilled"]);
  });

  it("counts admin analytics revenue only for confirmed/fulfilled orders, scoped correctly per vendor in topVendors", async () => {
    const res = await request(app).get("/api/admin/analytics").set("Cookie", [`session_token=${adminSessionToken}`]);
    expect(res.status).toBe(200);

    const vendorAEntry = res.body.topVendors.find((v: { vendorId: number }) => v.vendorId === vendorAId);
    const vendorBEntry = res.body.topVendors.find((v: { vendorId: number }) => v.vendorId === vendorBId);

    // Only the confirmed order (1000) should count for vendor A; the pending
    // order (also 1000) must be excluded.
    expect(vendorAEntry?.revenuePesewas).toBe(1000);
    expect(vendorAEntry?.orderCount).toBe(1);

    // Only the fulfilled order (2000) should count for vendor B; the
    // cancelled order (also 2000) must be excluded.
    expect(vendorBEntry?.revenuePesewas).toBe(2000);
    expect(vendorBEntry?.orderCount).toBe(1);
  });
});
