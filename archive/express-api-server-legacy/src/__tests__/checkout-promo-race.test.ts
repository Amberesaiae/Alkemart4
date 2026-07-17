import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import {
  db,
  addressesTable,
  cartItemsTable,
  cartsTable,
  categoriesTable,
  orderItemsTable,
  orderPaymentEventsTable,
  ordersTable,
  productsTable,
  promotionRedemptionsTable,
  promotionsTable,
  sessionsTable,
  userRolesTable,
  usersTable,
  vendorsTable,
} from "@workspace/db";
import app from "../app";
import { hashPassword, createSession } from "../lib/auth";

/**
 * Regression test for the promo-code counterpart of the stock-race refund
 * bug: two concurrent momo checkouts both apply a promo code with
 * usageLimit=1. Only one checkout may win the redemption; the transaction
 * for the loser rolls back with InvalidPromotionError *after* its Paystack
 * mobile money charge already succeeded, so checkout must refund that
 * charge automatically instead of leaving the buyer's money captured with
 * no order.
 *
 * Uses Paystack's documented sandbox test mobile money number for MTN
 * (0551234987), which always resolves synchronously to `success`.
 */
const MOMO_TEST_NUMBER = "0551234987";
const MOMO_TEST_PROVIDER = "mtn";

describe("concurrent checkout promo usage-limit race", () => {
  const suffix = randomUUID().slice(0, 8);
  let vendorId: number;
  let categoryId: number;
  let productId: number;
  let buyerAId: number;
  let buyerBId: number;
  const orderIds: number[] = [];
  const promotionIds: number[] = [];

  beforeAll(async () => {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY must be configured to run this test against the Paystack sandbox");
    }

    const [vendor] = await db
      .insert(vendorsTable)
      .values({ slug: `promo-race-vendor-${suffix}`, name: "Promo Race Vendor" })
      .returning();
    vendorId = vendor!.id;

    const [category] = await db
      .insert(categoriesTable)
      .values({ slug: `promo-race-category-${suffix}`, name: "Promo Race Category" })
      .returning();
    categoryId = category!.id;

    const [product] = await db
      .insert(productsTable)
      .values({
        vendorId,
        categoryId,
        slug: `promo-race-product-${suffix}`,
        title: "Promo Race Product",
        pricePesewas: 500,
        // Plenty of stock — this test isolates the promo usage-limit race
        // from the stock race, which already has its own coverage.
        stock: 100,
      })
      .returning();
    productId = product!.id;

    async function createBuyer(label: string) {
      const [user] = await db
        .insert(usersTable)
        .values({
          email: `promo-race-${label}-${suffix}@example.com`,
          passwordHash: await hashPassword("Password123!"),
          firstName: label,
        })
        .returning();
      const [address] = await db
        .insert(addressesTable)
        .values({
          buyerUserId: user!.id,
          fullName: `Buyer ${label}`,
          phone: "0551234987",
          line1: "1 Test Street",
          city: "Accra",
        })
        .returning();
      await db.insert(userRolesTable).values({ userId: user!.id, role: "buyer" });
      const cartSessionKey = randomUUID();
      const [cart] = await db.insert(cartsTable).values({ sessionKey: cartSessionKey }).returning();
      await db.insert(cartItemsTable).values({ cartId: cart!.id, productId, qty: 1 });
      const session = await createSession(user!.id);
      return { userId: user!.id, addressId: address!.id, cartSessionKey, sessionToken: session.token };
    }

    const [buyerA, buyerB] = await Promise.all([createBuyer("a"), createBuyer("b")]);
    buyerAId = buyerA.userId;
    buyerBId = buyerB.userId;

    (globalThis as unknown as { __promoRaceBuyers: [typeof buyerA, typeof buyerB] }).__promoRaceBuyers = [
      buyerA,
      buyerB,
    ];
  });

  afterAll(async () => {
    const orders = orderIds.length
      ? await db.select().from(ordersTable).where(eq(ordersTable.buyerUserId, buyerAId))
      : [];
    const allOrderIds = [
      ...orderIds,
      ...orders.map((o) => o.id),
      ...(await db.select().from(ordersTable).where(eq(ordersTable.buyerUserId, buyerBId))).map((o) => o.id),
    ];
    for (const orderId of new Set(allOrderIds)) {
      await db.delete(orderPaymentEventsTable).where(eq(orderPaymentEventsTable.orderId, orderId));
      await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
      await db.delete(promotionRedemptionsTable).where(eq(promotionRedemptionsTable.orderId, orderId));
      await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
    }
    await db.delete(cartItemsTable).where(eq(cartItemsTable.productId, productId));
    if (buyerAId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, buyerAId));
      await db.delete(userRolesTable).where(eq(userRolesTable.userId, buyerAId));
      await db.delete(addressesTable).where(eq(addressesTable.buyerUserId, buyerAId));
      await db.delete(usersTable).where(eq(usersTable.id, buyerAId));
    }
    if (buyerBId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, buyerBId));
      await db.delete(userRolesTable).where(eq(userRolesTable.userId, buyerBId));
      await db.delete(addressesTable).where(eq(addressesTable.buyerUserId, buyerBId));
      await db.delete(usersTable).where(eq(usersTable.id, buyerBId));
    }
    for (const id of new Set(promotionIds)) {
      await db.delete(promotionsTable).where(eq(promotionsTable.id, id));
    }
    if (productId) await db.delete(productsTable).where(eq(productsTable.id, productId));
    if (categoryId) await db.delete(categoriesTable).where(eq(categoriesTable.id, categoryId));
    if (vendorId) await db.delete(vendorsTable).where(eq(vendorsTable.id, vendorId));
  });

  it("refunds the losing buyer's momo charge when the promo's usage limit is hit concurrently", async () => {
    const [buyerA, buyerB] = (
      globalThis as unknown as {
        __promoRaceBuyers: [
          { userId: number; addressId: number; cartSessionKey: string; sessionToken: string },
          { userId: number; addressId: number; cartSessionKey: string; sessionToken: string },
        ];
      }
    ).__promoRaceBuyers;

    const checkout = (buyer: typeof buyerA, promoCode: string) =>
      request(app)
        .post("/api/checkout")
        .set("Cookie", [`session_token=${buyer.sessionToken}`, `cart_sid=${buyer.cartSessionKey}`])
        .send({
          addressId: buyer.addressId,
          paymentMethod: "momo",
          momoPhone: MOMO_TEST_NUMBER,
          momoProvider: MOMO_TEST_PROVIDER,
          promoCode,
        });

    const ensureCartItem = async (buyer: typeof buyerA) => {
      const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.sessionKey, buyer.cartSessionKey));
      await db
        .insert(cartItemsTable)
        .values({ cartId: cart!.id, productId, qty: 1 })
        .onConflictDoNothing();
    };

    // Paystack's sandbox occasionally declines one (or both) of two
    // *simultaneous* charges from the same test mobile money number as a
    // fraud/duplicate guard, unrelated to the promo logic under test — that
    // shows up as a 402 instead of exercising the race at all. Retry with a
    // brand-new usageLimit=1 promo code each time (so a lone decline doesn't
    // leave a stale redemption blocking a later real race) until we see a
    // clean run, or give up.
    let successes: Awaited<ReturnType<typeof checkout>>[] = [];
    let failures: Awaited<ReturnType<typeof checkout>>[] = [];
    const attempts = 4;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const [promotion] = await db
        .insert(promotionsTable)
        .values({
          code: `RACE${suffix}${attempt}`.toUpperCase(),
          discountType: "fixed",
          value: 100,
          isActive: true,
          usageLimit: 1,
        })
        .returning();
      promotionIds.push(promotion!.id);

      await Promise.all([ensureCartItem(buyerA), ensureCartItem(buyerB)]);
      const [resA, resB] = await Promise.all([
        checkout(buyerA, promotion!.code),
        checkout(buyerB, promotion!.code),
      ]);
      const responses = [resA, resB];
      successes = responses.filter((r) => r.status === 200);
      failures = responses.filter((r) => r.status !== 200);

      if (successes.length === 1) {
        orderIds.push(successes[0]!.body.id);
      }

      const gotCleanRace = successes.length === 1 && failures.length === 1 && failures[0]!.status === 400;
      const anyDeclined = failures.some((f) => f.status === 402);
      if (gotCleanRace || (!anyDeclined && successes.length !== 1) || attempt === attempts) {
        break;
      }
    }

    // Exactly one checkout wins the promo redemption; the other must fail
    // with the usage-limit error rather than silently succeeding twice.
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    expect(failures[0]!.status).toBe(400);
    expect(failures[0]!.body.error).toMatch(/usage limit/i);
    // The losing buyer's momo charge succeeded before the promo check
    // failed inside the transaction — checkout must have refunded it
    // automatically instead of leaving the charge captured with no order.
    expect(failures[0]!.body.error).toMatch(/refunded/i);

    const winningPromotionId = promotionIds[promotionIds.length - 1]!;
    const redemptions = await db
      .select()
      .from(promotionRedemptionsTable)
      .where(eq(promotionRedemptionsTable.promotionId, winningPromotionId));
    expect(redemptions).toHaveLength(1);
  });
});
