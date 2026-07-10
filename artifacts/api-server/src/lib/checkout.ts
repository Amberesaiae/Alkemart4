import { eq, sql } from "drizzle-orm";
import {
  db,
  addressesTable,
  cartItemsTable,
  fulfillmentsTable,
  orderItemsTable,
  orderPaymentEventsTable,
  ordersTable,
  productsTable,
  promotionRedemptionsTable,
} from "@workspace/db";
import type { Address, Fulfillment, Order, OrderItem, OrderPaymentMethod } from "@workspace/db";
import { domainEvents } from "./events";
import { validateAndComputePromotionDiscount, InvalidPromotionError } from "./promotions";

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

export { InvalidPromotionError };

/**
 * Read-only preview of what a cart would cost — used by the checkout route
 * to know the amount to charge through Paystack *before* committing to the
 * transaction that reserves stock and creates the order. Kept in lockstep
 * with the pricing logic inside `runCheckoutWorkflow`'s transaction, which
 * recomputes the authoritative total from the same tables at commit time.
 */
export async function quoteCart(cartId: number, promoCode?: string): Promise<{ subtotalPesewas: number; totalPesewas: number }> {
  const lines = await db
    .select({ qty: cartItemsTable.qty, product: productsTable })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(productsTable.id, cartItemsTable.productId))
    .where(eq(cartItemsTable.cartId, cartId));

  if (lines.length === 0) {
    throw new EmptyCartError();
  }

  const subtotalPesewas = lines.reduce((sum, line) => sum + line.product.pricePesewas * line.qty, 0);
  let discountPesewas = 0;
  if (promoCode) {
    const result = await validateAndComputePromotionDiscount(db, promoCode, subtotalPesewas);
    discountPesewas = result.discountPesewas;
  }
  return { subtotalPesewas, totalPesewas: subtotalPesewas - discountPesewas };
}

/**
 * Checkout workflow, modeled after Medusa's step-based workflow pattern but
 * implemented as a single Postgres transaction (no separate saga/queue infra
 * needed for a synchronous, single-process checkout):
 *
 *   1. Validate the cart is non-empty.
 *   2. Reserve inventory per line item — an atomic conditional UPDATE
 *      (`stock - reservedStock >= qty`) guards against overselling under
 *      concurrent checkouts; a failed reservation throws and the whole
 *      transaction rolls back (our compensation mechanism — no reservation
 *      is left dangling on any partial failure).
 *   3. Create the order + order items (title/price snapshotted at purchase
 *      time) + an initial `paid` payment event (no live payment gateway —
 *      see commerce-core task scope).
 *   4. Convert the reservation into a real stock decrement (today's checkout
 *      is synchronous, so reservation and fulfillment happen together; the
 *      columns stay separate so an async flow can split these steps later
 *      without a schema change).
 *   5. Clear the cart.
 *
 * On success (after commit), emits `order.placed` so other modules
 * (notifications, fulfillment) can react without checkout code depending on
 * them directly.
 */
export interface CheckoutPaymentInput {
  addressId: number;
  paymentMethod: OrderPaymentMethod;
  /** Present only for `momo` orders — the Paystack charge reference captured before this workflow runs. */
  paymentReference?: string;
}

export async function runCheckoutWorkflow(
  cartId: number,
  buyerUserId: number,
  promoCode: string | undefined,
  payment: CheckoutPaymentInput,
): Promise<OrderWithItems> {
  const order = await db.transaction(async (tx) => {
    const [address] = await tx
      .select()
      .from(addressesTable)
      .where(eq(addressesTable.id, payment.addressId));
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

    // Step 1: reserve inventory per line item with a single guarded UPDATE —
    // the new reservedStock is computed from the CURRENT row value in SQL
    // (not a JS value read earlier), and the WHERE clause only matches rows
    // that still have enough unreserved stock. Under concurrent transactions,
    // Postgres row-level locking serializes these UPDATEs per product, so
    // each one sees the other's committed-or-locked state instead of a stale
    // snapshot — this is what actually prevents overselling, not the
    // application-level re-check below (which just detects a lost race and
    // rolls the whole transaction back).
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

    // Step 1.5: validate and apply an optional promo code. Runs inside the
    // same transaction as the usage-limit check + redemption insert below so
    // concurrent checkouts against a limited-usage code can't both succeed.
    let discountPesewas = 0;
    let appliedPromotion: Awaited<ReturnType<typeof validateAndComputePromotionDiscount>>["promotion"] | null = null;
    if (promoCode) {
      const result = await validateAndComputePromotionDiscount(tx, promoCode, subtotalPesewas);
      discountPesewas = result.discountPesewas;
      appliedPromotion = result.promotion;
    }
    const totalPesewas = subtotalPesewas - discountPesewas;

    // Step 2: create the order + summary snapshot.
    const [createdOrder] = await tx
      .insert(ordersTable)
      .values({
        buyerUserId,
        status: "confirmed",
        subtotalPesewas,
        discountPesewas,
        promotionCode: appliedPromotion?.code ?? null,
        totalPesewas,
        addressId: address.id,
        paymentMethod: payment.paymentMethod,
      })
      .returning();
    if (!createdOrder) {
      throw new Error("Failed to create order");
    }

    if (appliedPromotion) {
      await tx.insert(promotionRedemptionsTable).values({
        promotionId: appliedPromotion.id,
        orderId: createdOrder.id,
        buyerUserId,
        discountPesewas,
      });
    }

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

    // Step 3: append-only payment ledger. `momo` orders are charged through
    // Paystack *before* this transaction starts (see the /checkout route),
    // so by the time we get here the charge has already succeeded — this
    // just records that capture against the order. `cash_on_delivery`
    // orders record a `cod_pending` event instead: the buyer owes the
    // courier at drop-off, not Paystack.
    if (payment.paymentMethod === "momo") {
      await tx.insert(orderPaymentEventsTable).values({
        orderId: createdOrder.id,
        type: "paid",
        amountPesewas: totalPesewas,
        provider: "paystack",
        providerReference: payment.paymentReference,
        note: "Charged via Paystack mobile money.",
      });
    } else {
      await tx.insert(orderPaymentEventsTable).values({
        orderId: createdOrder.id,
        type: "cod_pending",
        amountPesewas: totalPesewas,
        provider: "cash_on_delivery",
        note: "To be collected by the courier on delivery.",
      });
    }

    // Step 4: convert the reservation into a real decrement — checkout is
    // synchronous today, so reservation + fulfillment happen in one step.
    // Both columns are updated relative to their CURRENT row value in SQL
    // (not a JS-cached value from the initial read) so this stays correct
    // even though other rows/lines may have been touched since that read.
    for (const line of lines) {
      await tx
        .update(productsTable)
        .set({
          stock: sql`${productsTable.stock} - ${line.qty}`,
          reservedStock: sql`${productsTable.reservedStock} - ${line.qty}`,
        })
        .where(eq(productsTable.id, line.productId));
    }

    // Step 5: clear the cart.
    await tx.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cartId));

    // Step 6: one fulfillment row per vendor represented in this order, so
    // each vendor tracks and updates their own shipment independently.
    const vendorIds = [...new Set(lines.map((line) => line.product.vendorId))];
    const fulfillments = await tx
      .insert(fulfillmentsTable)
      .values(vendorIds.map((vendorId) => ({ orderId: createdOrder.id, vendorId, status: "unfulfilled" as const })))
      .returning();

    const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, createdOrder.id));

    return { ...createdOrder, items, fulfillments, address };
  });

  domainEvents.emitEvent("order.placed", {
    orderId: order.id,
    buyerUserId,
    vendorIds: Array.from(new Set(order.items.map((item) => item.vendorId))),
    totalPesewas: order.totalPesewas,
    paymentMethod: payment.paymentMethod,
  });

  return order;
}
