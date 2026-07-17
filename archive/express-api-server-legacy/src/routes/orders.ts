import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, addressesTable, fulfillmentsTable, orderItemsTable, ordersTable, orderPaymentEventsTable, productsTable } from "@workspace/db";
import { isAdmin, vendorIdsFor } from "@workspace/abilities";
import {
  CancelMyOrderResponse,
  CheckoutBody,
  CheckoutResponse,
  GetOrderParams,
  GetOrderResponse,
  ListAdminOrdersResponse,
  ListMyOrdersResponse,
  ListVendorOrdersResponse,
} from "@workspace/api-zod";
import { getOrCreateCart } from "../lib/cart";
import {
  AddressNotFoundError,
  ChargeAmountMismatchError,
  EmptyCartError,
  InactiveProductError,
  InsufficientStockError,
  InvalidPromotionError,
  quoteCart,
  runCheckoutWorkflow,
} from "../lib/checkout";
import { chargeMobileMoney, refundMomoCharge, PaymentDeclinedError } from "../lib/paystack";
import { requireAbility } from "../middlewares/auth-session";
import { logger } from "../lib/logger";
import { domainEvents } from "../lib/events";

const router: IRouter = Router();

async function loadOrderWithItems(orderId: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) return null;
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const fulfillments = await db.select().from(fulfillmentsTable).where(eq(fulfillmentsTable.orderId, orderId));
  const address = order.addressId
    ? (await db.select().from(addressesTable).where(eq(addressesTable.id, order.addressId)))[0] ?? null
    : null;
  return { ...order, items, fulfillments, address };
}

async function loadFulfillmentsByOrder(orderIds: number[]) {
  const fulfillments = orderIds.length
    ? await db.select().from(fulfillmentsTable).where(inArray(fulfillmentsTable.orderId, orderIds))
    : [];
  const byOrder = new Map<number, typeof fulfillments>();
  for (const f of fulfillments) {
    const list = byOrder.get(f.orderId) ?? [];
    list.push(f);
    byOrder.set(f.orderId, list);
  }
  return byOrder;
}

router.post("/checkout", requireAbility("create", "Order"), async (req, res): Promise<void> => {
  const body = CheckoutBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (body.data.paymentMethod === "momo" && (!body.data.momoPhone || !body.data.momoProvider)) {
    res.status(400).json({ error: "momoPhone and momoProvider are required when paying with mobile money" });
    return;
  }

  const [address] = await db.select().from(addressesTable).where(eq(addressesTable.id, body.data.addressId));
  if (!address || address.buyerUserId !== req.user!.id) {
    res.status(400).json({ error: "Delivery address not found" });
    return;
  }

  const cart = await getOrCreateCart(req.cartSessionKey);

  let paymentReference: string | undefined;
  let chargedAmountPesewas: number | undefined;
  try {
    if (body.data.paymentMethod === "momo") {
      // Charge before the checkout transaction: the order must never be
      // created for a mobile money payment that wasn't actually approved.
      const quote = await quoteCart(cart.id, body.data.promoCode);
      const charge = await chargeMobileMoney({
        amountPesewas: quote.totalPesewas,
        email: req.user!.email,
        phone: body.data.momoPhone!,
        provider: body.data.momoProvider!,
      });
      paymentReference = charge.reference;
      chargedAmountPesewas = quote.totalPesewas;
    }

    const order = await runCheckoutWorkflow(
      cart.id,
      req.user!.id,
      body.data.promoCode,
      {
        addressId: body.data.addressId,
        paymentMethod: body.data.paymentMethod,
        paymentReference,
      },
      chargedAmountPesewas,
    );
    res.json(CheckoutResponse.parse(order));
  } catch (error) {
    // If a momo charge already succeeded before the failure, the buyer's
    // money is captured with no order to show for it — refund it rather
    // than leaving that reconciliation to chance. This only applies to
    // failures that happen *after* the charge (stock, promo, address); a
    // PaymentDeclinedError means the charge itself never succeeded.
    // InactiveProductError is included here: if a product is deactivated in the
    // narrow window between quoteCart (pre-charge) and the transaction commit,
    // the momo capture has already succeeded and we must refund it.
    const chargeSucceededButOrderFailed =
      paymentReference !== undefined &&
      chargedAmountPesewas !== undefined &&
      (error instanceof EmptyCartError ||
        error instanceof InsufficientStockError ||
        error instanceof InvalidPromotionError ||
        error instanceof AddressNotFoundError ||
        error instanceof ChargeAmountMismatchError ||
        error instanceof InactiveProductError);

    // Tracks the true outcome of the refund attempt (if one was made) so the
    // buyer-facing message never claims a refund that didn't actually happen.
    let refundOutcome: "refunded" | "refund_failed" | undefined;

    if (chargeSucceededButOrderFailed) {
      const refund = await refundMomoCharge({ reference: paymentReference!, amountPesewas: chargedAmountPesewas! });
      if (refund.ok) {
        refundOutcome = "refunded";
        logger.warn(
          { reference: paymentReference, amountPesewas: chargedAmountPesewas, reason: (error as Error).message },
          "Refunded mobile money charge after checkout failed post-payment",
        );
      } else {
        refundOutcome = "refund_failed";
        logger.error(
          { reference: paymentReference, amountPesewas: chargedAmountPesewas, reason: (error as Error).message, refundError: refund.error },
          "Failed to auto-refund mobile money charge after checkout failed post-payment — needs manual reconciliation",
        );
      }
    }

    const withRefundNote = (message: string) => {
      if (refundOutcome === "refunded") {
        return `${message}. Your mobile money payment has been refunded.`;
      }
      if (refundOutcome === "refund_failed") {
        return `${message}. Your mobile money payment was captured but the automatic refund failed — our support team has been notified and will refund you manually.`;
      }
      return message;
    };

    if (error instanceof EmptyCartError) {
      res.status(400).json({ error: withRefundNote(error.message) });
      return;
    }
    if (error instanceof InsufficientStockError) {
      res.status(409).json({ error: withRefundNote(error.message) });
      return;
    }
    if (error instanceof InvalidPromotionError) {
      res.status(400).json({ error: withRefundNote(error.message) });
      return;
    }
    if (error instanceof AddressNotFoundError) {
      res.status(400).json({ error: withRefundNote(error.message) });
      return;
    }
    if (error instanceof ChargeAmountMismatchError) {
      // Prices or promotions changed between quote and commit.  The charge has
      // already been refunded (above) if the refund succeeded.
      res.status(409).json({ error: withRefundNote("Checkout prices changed — please try again.") });
      return;
    }
    if (error instanceof InactiveProductError) {
      res.status(422).json({ error: withRefundNote(`${error.message} — please remove it from your cart and try again.`) });
      return;
    }
    if (error instanceof PaymentDeclinedError) {
      res.status(402).json({ error: error.message });
      return;
    }
    // Unknown error — log and return a safe 500 instead of crashing the process.
    logger.error({ err: error }, "POST /checkout unexpected error");
    res.status(500).json({ error: withRefundNote("Checkout failed due to an unexpected error. Please try again.") });
  }
});

router.get("/orders", requireAbility("read", "Order"), async (req, res): Promise<void> => {
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.buyerUserId, req.user!.id))
    .orderBy(desc(ordersTable.createdAt));

  const orderIds = orders.map((o) => o.id);
  const items = orderIds.length ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds)) : [];
  const itemsByOrder = new Map<number, typeof items>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }
  const fulfillmentsByOrder = await loadFulfillmentsByOrder(orderIds);
  const addressIds = [...new Set(orders.map((o) => o.addressId).filter((id): id is number => id != null))];
  const addresses = addressIds.length ? await db.select().from(addressesTable).where(inArray(addressesTable.id, addressIds)) : [];
  const addressById = new Map(addresses.map((a) => [a.id, a]));

  const result = orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
    fulfillments: fulfillmentsByOrder.get(order.id) ?? [],
    address: order.addressId ? addressById.get(order.addressId) ?? null : null,
  }));
  res.json(ListMyOrdersResponse.parse({ items: result, total: result.length }));
});

router.get("/vendor/orders", requireAbility("read", "Order"), async (req, res): Promise<void> => {
  const vendorIds = vendorIdsFor(req.user!.roles);
  if (vendorIds.length === 0) {
    res.json(ListVendorOrdersResponse.parse({ items: [], total: 0 }));
    return;
  }

  const rows = await db
    .select({
      id: orderItemsTable.id,
      orderId: orderItemsTable.orderId,
      productId: orderItemsTable.productId,
      vendorId: orderItemsTable.vendorId,
      titleSnapshot: orderItemsTable.titleSnapshot,
      pricePesewasSnapshot: orderItemsTable.pricePesewasSnapshot,
      qty: orderItemsTable.qty,
      subtotalPesewas: orderItemsTable.subtotalPesewas,
      orderStatus: ordersTable.status,
      orderCreatedAt: ordersTable.createdAt,
      fulfillmentStatus: fulfillmentsTable.status,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .innerJoin(
      fulfillmentsTable,
      and(eq(fulfillmentsTable.orderId, orderItemsTable.orderId), eq(fulfillmentsTable.vendorId, orderItemsTable.vendorId)),
    )
    .where(inArray(orderItemsTable.vendorId, vendorIds))
    .orderBy(desc(ordersTable.createdAt));

  res.json(ListVendorOrdersResponse.parse({ items: rows, total: rows.length }));
});

router.get("/admin/orders", requireAbility("read", "AdminPanel"), async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const orderIds = orders.map((o) => o.id);
  const items = orderIds.length ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds)) : [];
  const itemsByOrder = new Map<number, typeof items>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }
  const fulfillmentsByOrder = await loadFulfillmentsByOrder(orderIds);

  const result = orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
    fulfillments: fulfillmentsByOrder.get(order.id) ?? [],
  }));
  res.json(ListAdminOrdersResponse.parse({ items: result, total: result.length }));
});

router.get("/orders/:id", requireAbility("read", "Order"), async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const order = await loadOrderWithItems(params.data.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  // "read AdminPanel" covers both admin (manage all) and support_agent (read AdminPanel).
  const callerIsAdminOrSupport = isAdmin(req.user!.roles) || req.ability.can("read", "AdminPanel");
  const isBuyer = order.buyerUserId === req.user!.id;
  const vendorIds = vendorIdsFor(req.user!.roles);
  const isVendorOnOrder = order.items.some((item) => vendorIds.includes(item.vendorId));

  if (!callerIsAdminOrSupport && !isBuyer && !isVendorOnOrder) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(GetOrderResponse.parse(order));
});

router.post("/orders/:id/cancel", requireAbility("create", "Order"), async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const order = await loadOrderWithItems(params.data.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.buyerUserId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (order.status === "cancelled") {
    res.status(409).json({ error: "Order is already cancelled" });
    return;
  }

  if (order.status !== "confirmed" && order.status !== "pending") {
    res.status(409).json({ error: "Only pending or confirmed orders can be cancelled" });
    return;
  }

  // Lock order + all fulfillments FOR UPDATE to serialize against concurrent pack transitions.
  const cancelResult = await db.transaction(async (tx) => {
    const [lockedOrder] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order.id))
      .for("update");

    if (!lockedOrder || lockedOrder.status === "cancelled") {
      return { ok: false as const, reason: "already_cancelled" };
    }
    if (lockedOrder.status !== "confirmed" && lockedOrder.status !== "pending") {
      return { ok: false as const, reason: "invalid_status" };
    }

    const lockedFulfillments = await tx
      .select()
      .from(fulfillmentsTable)
      .where(eq(fulfillmentsTable.orderId, order.id))
      .for("update");

    // Guard: if any fulfillment exists, ALL must be unfulfilled.
    if (lockedFulfillments.length > 0) {
      const allUnfulfilled = lockedFulfillments.every((f) => f.status === "unfulfilled");
      if (!allUnfulfilled) {
        return { ok: false as const, reason: "fulfillments_not_unfulfilled" };
      }
    }

    const isPending = lockedOrder.status === "pending";

    if (isPending) {
      // Pending unpaid: release reservedStock only (stock not yet decremented).
      for (const item of order.items) {
        await tx
          .update(productsTable)
          .set({ reservedStock: sql`${productsTable.reservedStock} - ${item.qty}` })
          .where(eq(productsTable.id, item.productId));
      }
      // Append payment event.
      await tx.insert(orderPaymentEventsTable).values({
        orderId: order.id,
        type: "failed",
        amountPesewas: 0,
        note: "Pending order cancelled — no payment captured",
      });
    } else {
      // Confirmed: restock sold units (stock was already decremented).
      for (const item of order.items) {
        await tx
          .update(productsTable)
          .set({ stock: sql`${productsTable.stock} + ${item.qty}` })
          .where(eq(productsTable.id, item.productId));
      }
    }

    // Cancel the order.
    await tx.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, order.id));

    return { ok: true as const, isPending, paymentMethod: lockedOrder.paymentMethod };
  });

  if (!cancelResult.ok) {
    if (cancelResult.reason === "already_cancelled") {
      res.status(409).json({ error: "Order is already cancelled" });
    } else if (cancelResult.reason === "invalid_status") {
      res.status(409).json({ error: "Only pending or confirmed orders can be cancelled" });
    } else {
      res.status(409).json({ error: "Cannot cancel — order has items being fulfilled" });
    }
    return;
  }

  // After commit: refund MoMo if confirmed and has a paid event.
  let refundOutcome: "refunded" | "refund_failed" | "skipped" = "skipped";
  if (!cancelResult.isPending && cancelResult.paymentMethod === "momo") {
    // Find the payment reference from the paid event.
    const [paidEvent] = await db
      .select()
      .from(orderPaymentEventsTable)
      .where(and(eq(orderPaymentEventsTable.orderId, order.id), eq(orderPaymentEventsTable.type, "paid")))
      .orderBy(desc(orderPaymentEventsTable.createdAt));

    if (paidEvent?.providerReference) {
      const refund = await refundMomoCharge({
        reference: paidEvent.providerReference,
        amountPesewas: order.totalPesewas,
      });
      if (refund.ok) {
        refundOutcome = "refunded";
      } else {
        refundOutcome = "refund_failed";
        logger.error(
          { orderId: order.id, reference: paidEvent.providerReference, error: refund.error },
          "Failed to refund MoMo charge on cancel — needs manual reconciliation",
        );
      }
    }

    // Append truthful ledger entry.
    await db.insert(orderPaymentEventsTable).values({
      orderId: order.id,
      type: refundOutcome === "refunded" ? "refunded" : "refund_failed",
      amountPesewas: refundOutcome === "refunded" ? order.totalPesewas : 0,
      provider: "paystack",
      providerReference: paidEvent?.providerReference,
      note:
        refundOutcome === "refunded"
          ? "Full refund issued on cancel"
          : refundOutcome === "refund_failed"
            ? "Refund attempt failed — needs manual retry"
            : "No payment reference found for refund",
    });
  }

  // Emit domain event.
  domainEvents.emitEvent("order.placed", {
    orderId: order.id,
    buyerUserId: req.user!.id,
    vendorIds: [...new Set(order.items.map((i) => i.vendorId))],
    totalPesewas: order.totalPesewas,
    paymentMethod: cancelResult.paymentMethod ?? "momo",
  });

  const cancelled = await loadOrderWithItems(order.id);
  res.json(CancelMyOrderResponse.parse(cancelled));
});

export default router;
