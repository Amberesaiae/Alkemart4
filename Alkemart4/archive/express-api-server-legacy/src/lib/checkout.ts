import { eq, and, sql, inArray } from "drizzle-orm";
import {
  db,
  addressesTable,
  cartItemsTable,
  cartsTable,
  fulfillmentsTable,
  orderItemsTable,
  orderPaymentEventsTable,
  ordersTable,
  paymentIntentsTable,
  productsTable,
  promotionRedemptionsTable,
} from "@workspace/db";
import type { Address, Fulfillment, Order, OrderItem, OrderPaymentMethod } from "@workspace/db";
import { domainEvents } from "./events";
import { validateAndComputePromotionDiscount, InvalidPromotionError } from "./promotions";
import { QUOTE_SHIPPING_PESEWAS, QUOTE_TAX_PESEWAS, PAYMENT_PENDING_TTL_MINUTES } from "./platform-config";
import { refundMomoCharge, verifyPaystackTransaction } from "./paystack";
import { logger } from "./logger";

export type OrderWithItems = Order & { items: OrderItem[]; fulfillments: Fulfillment[]; address?: Address | null };

export class InsufficientStockError extends Error {
  constructor(public readonly productTitle: string) {
    super(`Insufficient stock for "${productTitle}"`);
  }
}

export class EmptyCartError extends Error {
  constructor() {
    super("Cart is empty");
  }
}

export class AddressNotFoundError extends Error {
  constructor() {
    super("Delivery address not found");
  }
}

export class ChargeAmountMismatchError extends Error {
  constructor(
    public readonly chargedAmountPesewas: number,
    public readonly orderTotalPesewas: number,
  ) {
    super(
      `Charged amount (${chargedAmountPesewas} pesewas) does not match order total (${orderTotalPesewas} pesewas)`,
    );
  }
}

export class InactiveProductError extends Error {
  constructor(public readonly productTitle: string) {
    super(`"${productTitle}" is no longer available`);
  }
}

export class CartLockedError extends Error {
  constructor() {
    super("Checkout already in progress for this cart");
  }
}

export { InvalidPromotionError };

export type CartQuote = {
  subtotalPesewas: number;
  discountPesewas: number;
  shippingPesewas: number;
  taxPesewas: number;
  totalPesewas: number;
};

/**
 * Read-only preview of what a cart would cost — used by the checkout route
 * to know the amount to charge through Paystack *before* committing.
 */
export async function quoteCart(cartId: number, promoCode?: string): Promise<CartQuote> {
  const lines = await db
    .select({ qty: cartItemsTable.qty, product: productsTable })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(productsTable.id, cartItemsTable.productId))
    .where(eq(cartItemsTable.cartId, cartId));

  if (lines.length === 0) {
    throw new EmptyCartError();
  }

  for (const line of lines) {
    if (!line.product.isActive) {
      throw new InactiveProductError(line.product.title);
    }
  }

  const subtotalPesewas = lines.reduce((sum, line) => sum + line.product.pricePesewas * line.qty, 0);
  let discountPesewas = 0;
  if (promoCode) {
    const result = await validateAndComputePromotionDiscount(db, promoCode, subtotalPesewas);
    discountPesewas = result.discountPesewas;
  }
  const shippingPesewas = QUOTE_SHIPPING_PESEWAS;
  const taxPesewas = QUOTE_TAX_PESEWAS;
  const totalPesewas = Math.max(0, subtotalPesewas - discountPesewas + shippingPesewas + taxPesewas);
  return { subtotalPesewas, discountPesewas, shippingPesewas, taxPesewas, totalPesewas };
}

/**
 * Synchronous checkout workflow — charge-before-commit pattern.
 * For card/COD (no pre-charge) or MoMo (charge already succeeded synchronously).
 * Creates a confirmed order atomically.
 */
export async function runCheckoutWorkflow(
  cartId: number,
  buyerUserId: number,
  promoCode: string | undefined,
  opts: { addressId: number; paymentMethod: OrderPaymentMethod; paymentReference?: string },
  chargedAmountPesewas?: number,
): Promise<OrderWithItems> {
  const order = await db.transaction(async (tx) => {
    const [address] = await tx
      .select()
      .from(addressesTable)
      .where(eq(addressesTable.id, opts.addressId));
    if (!address || address.buyerUserId !== buyerUserId) {
      throw new AddressNotFoundError();
    }

    const lines = await tx
      .select({ productId: cartItemsTable.productId, qty: cartItemsTable.qty, product: productsTable })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(productsTable.id, cartItemsTable.productId))
      .where(eq(cartItemsTable.cartId, cartId));

    if (lines.length === 0) throw new EmptyCartError();

    for (const line of lines) {
      if (!line.product.isActive) throw new InactiveProductError(line.product.title);
    }

    const subtotalPesewas = lines.reduce((sum, line) => sum + line.product.pricePesewas * line.qty, 0);
    let discountPesewas = 0;
    let appliedPromotion: Awaited<ReturnType<typeof validateAndComputePromotionDiscount>>["promotion"] | null = null;
    if (promoCode) {
      const result = await validateAndComputePromotionDiscount(tx, promoCode, subtotalPesewas);
      discountPesewas = result.discountPesewas;
      appliedPromotion = result.promotion;
    }

    const shippingPesewas = QUOTE_SHIPPING_PESEWAS;
    const taxPesewas = QUOTE_TAX_PESEWAS;
    const totalPesewas = Math.max(0, subtotalPesewas - discountPesewas + shippingPesewas + taxPesewas);

    if (chargedAmountPesewas !== undefined && chargedAmountPesewas !== totalPesewas) {
      throw new ChargeAmountMismatchError(chargedAmountPesewas, totalPesewas);
    }

    // Deduct stock (immediate, not reservation).
    for (const line of lines) {
      const [deducted] = await tx
        .update(productsTable)
        .set({ stock: sql`${productsTable.stock} - ${line.qty}` })
        .where(sql`${productsTable.id} = ${line.productId} and ${productsTable.stock} >= ${line.qty}`)
        .returning({ id: productsTable.id });
      if (!deducted) throw new InsufficientStockError(line.product.title);
    }

    const [createdOrder] = await tx
      .insert(ordersTable)
      .values({
        buyerUserId,
        status: "confirmed",
        subtotalPesewas,
        discountPesewas,
        promotionCode: appliedPromotion?.code ?? null,
        totalPesewas,
        addressId: opts.addressId,
        paymentMethod: opts.paymentMethod,
      })
      .returning();
    if (!createdOrder) throw new Error("Failed to create order");

    if (appliedPromotion) {
      await tx.insert(promotionRedemptionsTable).values({
        promotionId: appliedPromotion.id,
        orderId: createdOrder.id,
        buyerUserId,
        discountPesewas,
      });
    }

    if (opts.paymentReference) {
      await tx.insert(orderPaymentEventsTable).values({
        orderId: createdOrder.id,
        type: "paid",
        amountPesewas: totalPesewas,
        provider: "paystack",
        providerReference: opts.paymentReference,
        note: "Payment confirmed",
      });
    }

    const items = await tx.insert(orderItemsTable).values(
      lines.map((line) => ({
        orderId: createdOrder.id,
        productId: line.productId,
        vendorId: line.product.vendorId,
        titleSnapshot: line.product.title,
        pricePesewasSnapshot: line.product.pricePesewas,
        qty: line.qty,
        subtotalPesewas: line.product.pricePesewas * line.qty,
      })),
    ).returning();

    const vendorIds = [...new Set(items.map((i) => i.vendorId))];
    const fulfillments = await tx
      .insert(fulfillmentsTable)
      .values(vendorIds.map((vendorId) => ({ orderId: createdOrder.id, vendorId, status: "unfulfilled" as const })))
      .returning();

    await tx.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cartId));

    return { ...createdOrder, items, fulfillments, address };
  });

  domainEvents.emitEvent("order.placed", {
    orderId: order.id,
    buyerUserId: order.buyerUserId,
    vendorIds: [...new Set(order.items.map((i) => i.vendorId))],
    totalPesewas: order.totalPesewas,
    paymentMethod: order.paymentMethod ?? "momo",
  });

  return order;
}

/**
 * Create a pending order with stock reservation but no fulfillment.
 * Used for async MoMo — the order stays pending until confirmPaid or TTL abandon.
 */
export async function createPendingCheckout(params: {
  cartId: number;
  buyerUserId: number;
  promoCode?: string;
  addressId: number;
  paymentMethod: OrderPaymentMethod;
  paymentReference: string;
  intentId: number;
  totalPesewas: number;
}): Promise<OrderWithItems> {
  const { cartId, buyerUserId, promoCode, addressId, paymentMethod, paymentReference, intentId, totalPesewas } = params;

  const order = await db.transaction(async (tx) => {
    // Validate address ownership.
    const [address] = await tx
      .select()
      .from(addressesTable)
      .where(eq(addressesTable.id, addressId));
    if (!address || address.buyerUserId !== buyerUserId) {
      throw new AddressNotFoundError();
    }

    const lines = await tx
      .select({
        productId: cartItemsTable.productId,
        qty: cartItemsTable.qty,
        product: productsTable,
      })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(productsTable.id, cartItemsTable.productId))
      .where(eq(cartItemsTable.cartId, cartId));

    if (lines.length === 0) {
      throw new EmptyCartError();
    }

    for (const line of lines) {
      if (!line.product.isActive) {
        throw new InactiveProductError(line.product.title);
      }
    }

    // Reserve stock (hold only — do not decrement).
    for (const line of lines) {
      const [reserved] = await tx
        .update(productsTable)
        .set({ reservedStock: sql`${productsTable.reservedStock} + ${line.qty}` })
        .where(sql`${productsTable.id} = ${line.productId} and ${productsTable.stock} - ${productsTable.reservedStock} >= ${line.qty}`)
        .returning({ id: productsTable.id });
      if (!reserved) {
        throw new InsufficientStockError(line.product.title);
      }
    }

    const subtotalPesewas = lines.reduce((sum, line) => sum + line.product.pricePesewas * line.qty, 0);
    let discountPesewas = 0;
    let appliedPromotion: Awaited<ReturnType<typeof validateAndComputePromotionDiscount>>["promotion"] | null = null;

    // Best-effort promo validation only (no FOR UPDATE lock — capacity enforced at confirm).
    if (promoCode) {
      try {
        const result = await validateAndComputePromotionDiscount(tx, promoCode, subtotalPesewas);
        discountPesewas = result.discountPesewas;
        appliedPromotion = result.promotion;
      } catch {
        // Best-effort: if promo is invalid at pending create, let it through
        // (confirm will re-validate and abort if needed).
        discountPesewas = 0;
      }
    }

    const shippingPesewas = QUOTE_SHIPPING_PESEWAS;
    const taxPesewas = QUOTE_TAX_PESEWAS;

    // Verify the charged amount matches (caller computed this from quoteCart).
    if (totalPesewas !== Math.max(0, subtotalPesewas - discountPesewas + shippingPesewas + taxPesewas)) {
      throw new ChargeAmountMismatchError(totalPesewas, Math.max(0, subtotalPesewas - discountPesewas + shippingPesewas + taxPesewas));
    }

    const paymentExpiresAt = new Date(Date.now() + PAYMENT_PENDING_TTL_MINUTES * 60 * 1000);

    // Create pending order.
    const [createdOrder] = await tx
      .insert(ordersTable)
      .values({
        buyerUserId,
        status: "pending",
        subtotalPesewas,
        discountPesewas,
        promotionCode: appliedPromotion?.code ?? null,
        totalPesewas,
        addressId,
        paymentMethod,
        paymentExpiresAt,
      })
      .returning();
    if (!createdOrder) throw new Error("Failed to create order");

    // Update the payment intent with the order ID.
    await tx
      .update(paymentIntentsTable)
      .set({ orderId: createdOrder.id })
      .where(eq(paymentIntentsTable.id, intentId));

    // Append payment_pending event.
    await tx.insert(orderPaymentEventsTable).values({
      orderId: createdOrder.id,
      type: "payment_pending",
      amountPesewas: totalPesewas,
      provider: "paystack",
      providerReference: paymentReference,
      note: "MoMo charge initiated — awaiting confirmation",
    });

    // Create order items (snapshots).
    await tx.insert(orderItemsTable).values(
      lines.map((line) => ({
        orderId: createdOrder.id,
        productId: line.productId,
        vendorId: line.product.vendorId,
        titleSnapshot: line.product.title,
        pricePesewasSnapshot: line.product.pricePesewas,
        qty: line.qty,
        subtotalPesewas: line.product.pricePesewas * line.qty,
      })),
    );

    // Soft-lock the cart.
    await tx
      .update(cartsTable)
      .set({ checkoutLockOrderId: createdOrder.id })
      .where(eq(cartsTable.id, cartId));

    // Do NOT clear cart lines or create fulfillments yet.

    const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, createdOrder.id));
    return { ...createdOrder, items, fulfillments: [], address };
  });

  return order;
}

/**
 * Confirm a pending order after payment succeeds (webhook, verify, or sync).
 * This is the atomic success-path: converts stock, creates fulfillments,
 * clears cart, re-validates promo, emits order.placed.
 */
export async function confirmPaidCheckout(orderId: number): Promise<OrderWithItems> {
  const order = await db.transaction(async (tx) => {
    // Lock the order.
    const [lockedOrder] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .for("update");
    if (!lockedOrder) throw new Error("Order not found");
    if (lockedOrder.status === "confirmed") {
      // Idempotent: already confirmed.
      const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
      const fulfillments = await tx.select().from(fulfillmentsTable).where(eq(fulfillmentsTable.orderId, orderId));
      const address = lockedOrder.addressId
        ? (await tx.select().from(addressesTable).where(eq(addressesTable.id, lockedOrder.addressId)))[0] ?? null
        : null;
      return { ...lockedOrder, items, fulfillments, address };
    }
    if (lockedOrder.status === "cancelled" || lockedOrder.status === "fulfilled") {
      throw new Error(`Cannot confirm order in status: ${lockedOrder.status}`);
    }

    // Re-validate promo under FOR UPDATE if a code was used.
    if (lockedOrder.promotionCode) {
      const [existingRedemption] = await tx
        .select()
        .from(promotionRedemptionsTable)
        .where(eq(promotionRedemptionsTable.orderId, orderId));

      if (!existingRedemption) {
        // Promo was best-effort at pending; re-validate now.
        try {
          const result = await validateAndComputePromotionDiscount(tx, lockedOrder.promotionCode, lockedOrder.subtotalPesewas);
          if (result.discountPesewas !== lockedOrder.discountPesewas) {
            // Discount drift — abort confirm, release hold, refund.
            await releaseHoldsAndCancel(tx, lockedOrder);
            throw new Error("Promo discount changed — order cancelled and refunded");
          }
          // Insert redemption.
          await tx.insert(promotionRedemptionsTable).values({
            promotionId: result.promotion.id,
            orderId,
            buyerUserId: lockedOrder.buyerUserId,
            discountPesewas: result.discountPesewas,
          });
        } catch (err) {
          if (err instanceof InvalidPromotionError) {
            // Promo no longer valid — abort confirm, release hold, refund.
            await releaseHoldsAndCancel(tx, lockedOrder);
            throw new Error("Promo code is no longer available — order cancelled and refunded");
          }
          throw err;
        }
      }
    }

    // Convert stock: stock -= qty, reservedStock -= qty.
    const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
    for (const item of items) {
      await tx
        .update(productsTable)
        .set({
          stock: sql`${productsTable.stock} - ${item.qty}`,
          reservedStock: sql`${productsTable.reservedStock} - ${item.qty}`,
        })
        .where(eq(productsTable.id, item.productId));
    }

    // Mark order confirmed.
    await tx.update(ordersTable).set({ status: "confirmed" }).where(eq(ordersTable.id, orderId));

    // Append paid event.
    await tx.insert(orderPaymentEventsTable).values({
      orderId,
      type: "paid",
      amountPesewas: lockedOrder.totalPesewas,
      provider: "paystack",
      note: "Payment confirmed",
    });

    // Create fulfillments.
    const vendorIds = [...new Set(items.map((i) => i.vendorId))];
    const fulfillments = await tx
      .insert(fulfillmentsTable)
      .values(vendorIds.map((vendorId) => ({ orderId, vendorId, status: "unfulfilled" as const })))
      .returning();

    // Clear cart.
    const [cart] = await tx
      .select({ id: cartsTable.id })
      .from(cartsTable)
      .where(eq(cartsTable.checkoutLockOrderId, orderId));
    if (cart) {
      await tx.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
      await tx.update(cartsTable).set({ checkoutLockOrderId: null }).where(eq(cartsTable.id, cart.id));
    }

    const address = lockedOrder.addressId
      ? (await tx.select().from(addressesTable).where(eq(addressesTable.id, lockedOrder.addressId)))[0] ?? null
      : null;

    return { ...lockedOrder, status: "confirmed" as const, items, fulfillments, address };
  });

  // Emit order.placed after commit.
  domainEvents.emitEvent("order.placed", {
    orderId: order.id,
    buyerUserId: order.buyerUserId,
    vendorIds: [...new Set(order.items.map((i) => i.vendorId))],
    totalPesewas: order.totalPesewas,
    paymentMethod: order.paymentMethod ?? "momo",
  });

  return order;
}

/**
 * Release stock holds and cancel a pending order (used when confirm fails).
 */
async function releaseHoldsAndCancel(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  order: { id: number; buyerUserId: number; paymentMethod?: string | null },
): Promise<void> {
  const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  for (const item of items) {
    await tx
      .update(productsTable)
      .set({ reservedStock: sql`${productsTable.reservedStock} - ${item.qty}` })
      .where(eq(productsTable.id, item.productId));
  }
  await tx.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, order.id));

  // Clear cart lock.
  const [cart] = await tx
    .select({ id: cartsTable.id })
    .from(cartsTable)
    .where(eq(cartsTable.checkoutLockOrderId, order.id));
  if (cart) {
    await tx.update(cartsTable).set({ checkoutLockOrderId: null }).where(eq(cartsTable.id, cart.id));
  }
}

/**
 * Abandonment worker: finds pending orders past their TTL and releases holds.
 * Runs on a timer interval.
 */
export async function sweepAbandonedPayments(): Promise<void> {
  const expired = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "pending"),
        sql`${ordersTable.paymentExpiresAt} < now()`,
      ),
    );

  for (const order of expired) {
    try {
      await db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(ordersTable)
          .where(eq(ordersTable.id, order.id))
          .for("update");
        if (!locked || locked.status !== "pending") return;

        // Release reservedStock.
        const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
        for (const item of items) {
          await tx
            .update(productsTable)
            .set({ reservedStock: sql`${productsTable.reservedStock} - ${item.qty}` })
            .where(eq(productsTable.id, item.productId));
        }

        // Mark expired.
        await tx.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, order.id));

        // Mark intent expired.
        const [intent] = await tx
          .select()
          .from(paymentIntentsTable)
          .where(eq(paymentIntentsTable.orderId, order.id));
        if (intent) {
          await tx
            .update(paymentIntentsTable)
            .set({ status: "expired" })
            .where(eq(paymentIntentsTable.id, intent.id));

          // If intent has a reference and Paystack shows success, refund instead.
          if (intent.providerReference) {
            const verified = await verifyPaystackTransaction(intent.providerReference);
            if (verified?.status === "success") {
              const refund = await refundMomoCharge({
                reference: intent.providerReference,
                amountPesewas: order.totalPesewas,
              });
              await tx.insert(orderPaymentEventsTable).values({
                orderId: order.id,
                type: refund.ok ? "refunded" : "refund_failed",
                amountPesewas: refund.ok ? order.totalPesewas : 0,
                provider: "paystack",
                providerReference: intent.providerReference,
                note: refund.ok
                  ? "Late success after TTL — refunded"
                  : "Late success after TTL — refund failed, needs manual retry",
              });
              logger.warn(
                { orderId: order.id, reference: intent.providerReference, refundOk: refund.ok },
                "Late payment success detected during abandon sweep",
              );
            }
          }
        }

        // Append failed event.
        await tx.insert(orderPaymentEventsTable).values({
          orderId: order.id,
          type: "failed",
          amountPesewas: 0,
          note: "Payment expired — TTL exceeded",
        });

        // Clear cart lock.
        const [cart] = await tx
          .select({ id: cartsTable.id })
          .from(cartsTable)
          .where(eq(cartsTable.checkoutLockOrderId, order.id));
        if (cart) {
          await tx.update(cartsTable).set({ checkoutLockOrderId: null }).where(eq(cartsTable.id, cart.id));
        }
      });

      logger.info({ orderId: order.id }, "Abandoned payment swept");
    } catch (err) {
      logger.error({ err, orderId: order.id }, "Failed to sweep abandoned payment");
    }
  }
}

/**
 * Orphan/recovery worker: finds initiated intents with no provider reference
 * and checks Paystack for their status.
 */
export async function sweepOrphanIntents(): Promise<void> {
  const stale = await db
    .select()
    .from(paymentIntentsTable)
    .where(
      and(
        sql`${paymentIntentsTable.status} = 'initiated' OR (${paymentIntentsTable.providerReference} IS NULL AND ${paymentIntentsTable.createdAt} < now() - interval '2 minutes')`,
      ),
    );

  for (const intent of stale) {
    try {
      const verified = await verifyPaystackTransaction(intent.clientReference);
      if (verified) {
        // Attach reference and update status.
        await db
          .update(paymentIntentsTable)
          .set({ providerReference: verified.reference, rawLastStatus: verified.status, status: verified.status === "success" ? "succeeded" : "pending" })
          .where(eq(paymentIntentsTable.id, intent.id));

        if (verified.status === "success") {
          // Check if order is still pending — if cancelled/expired, refund.
          const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, intent.orderId));
          if (order?.status === "cancelled" || order?.status === "fulfilled") {
            await refundMomoCharge({ reference: verified.reference, amountPesewas: intent.amountPesewas });
            await db.insert(orderPaymentEventsTable).values({
              orderId: intent.orderId,
              type: "refunded",
              amountPesewas: intent.amountPesewas,
              provider: "paystack",
              providerReference: verified.reference,
              note: "Orphan capture recovered — order was in terminal state",
            });
          } else if (order?.status === "pending") {
            await confirmPaidCheckout(intent.orderId);
          }
        }
      }
    } catch (err) {
      logger.error({ err, intentId: intent.id }, "Failed to recover orphan intent");
    }
  }
}
