import { EventEmitter } from "events";
import { and, eq, inArray } from "drizzle-orm";
import { db, notificationsTable, userRolesTable, usersTable } from "@workspace/db";
import type { OrderPaymentMethod } from "@workspace/db";
import { logger } from "./logger";
import { sendEmail } from "./email";

/**
 * Lightweight in-process domain event dispatcher (Medusa's event-bus pattern,
 * without Redis/queue infra — this is a single-process Express app, so an
 * in-memory emitter is the right scope). This is the seam future modules
 * (fulfillment status changes, notifications) attach subscribers to, without
 * coupling checkout/order logic directly to notification-sending code.
 *
 * Events are emitted only after the triggering DB transaction has committed,
 * so a subscriber never observes a row that a rolled-back transaction undid.
 */
export interface DomainEvents {
  "order.placed": {
    orderId: number;
    buyerUserId: number;
    vendorIds: number[];
    totalPesewas: number;
    paymentMethod: OrderPaymentMethod;
  };
  "fulfillment.status_changed": {
    fulfillmentId: number;
    orderId: number;
    vendorId: number;
    status: string;
    previousStatus: string;
    buyerUserId?: number;
  };
}

class DomainEventBus extends EventEmitter {
  emitEvent<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
    this.emit(event, payload);
  }

  onEvent<K extends keyof DomainEvents>(event: K, listener: (payload: DomainEvents[K]) => void): void {
    this.on(event, listener);
  }
}

export const domainEvents = new DomainEventBus();

/**
 * In-app notification subscriber for `order.placed` (Medusa's Notification
 * module pattern, implemented natively): writes a buyer confirmation
 * notification plus one "new order" notification per vendor_owner of each
 * vendor represented in the order. This only ever writes rows to the
 * `notifications` table — a real email/SMS provider would subscribe to the
 * same `order.placed` event independently, so adding one later never
 * changes this code path.
 */
domainEvents.onEvent("order.placed", (payload) => {
  logger.info({ event: "order.placed", ...payload }, "Domain event: order.placed");

  void (async () => {
    try {
      const rows: (typeof notificationsTable.$inferInsert)[] = [
        {
          userId: payload.buyerUserId,
          type: "order.confirmed",
          data: { orderId: payload.orderId, totalPesewas: payload.totalPesewas },
        },
      ];

      if (payload.vendorIds.length > 0) {
        const vendorOwners = await db
          .select({ userId: userRolesTable.userId, vendorId: userRolesTable.vendorId })
          .from(userRolesTable)
          .where(and(inArray(userRolesTable.vendorId, payload.vendorIds), eq(userRolesTable.role, "vendor_owner")));

        for (const owner of vendorOwners) {
          if (owner.vendorId == null) continue;
          rows.push({
            userId: owner.userId,
            type: "order.new_for_vendor",
            data: { orderId: payload.orderId, vendorId: owner.vendorId },
          });
        }
      }

      await db.insert(notificationsTable).values(rows);
    } catch (error) {
      logger.error({ error, event: "order.placed" }, "Failed to create notifications for order.placed");
    }
  })();
});

/**
 * Email receipt subscriber for `order.placed` (Resend). Runs independently
 * of the in-app notification subscriber above — a failure here (bad
 * address, provider outage) is logged and swallowed, never re-thrown into
 * the event bus, so it can never affect checkout or the in-app notification
 * that already confirmed the order to the buyer.
 */
domainEvents.onEvent("order.placed", (payload) => {
  void (async () => {
    try {
      const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, payload.buyerUserId));
      if (!buyer) {
        logger.warn({ event: "order.placed", buyerUserId: payload.buyerUserId }, "Buyer not found for order receipt email");
        return;
      }

      const amount = (payload.totalPesewas / 100).toFixed(2);
      const paymentLine =
        payload.paymentMethod === "momo"
          ? "Paid via mobile money."
          : "Pay the courier by cash on delivery when your order arrives.";

      await sendEmail({
        to: buyer.email,
        subject: `Order #${payload.orderId} confirmed — Alkemart`,
        html: `
          <p>Hi${buyer.firstName ? ` ${buyer.firstName}` : ""},</p>
          <p>Your order <strong>#${payload.orderId}</strong> has been confirmed.</p>
          <p><strong>Total: GHS ${amount}</strong></p>
          <p>${paymentLine}</p>
          <p>We'll keep you posted on delivery updates.</p>
        `,
      });
    } catch (error) {
      logger.error({ error, event: "order.placed" }, "Failed to send order receipt email");
    }
  })();
});

domainEvents.onEvent("fulfillment.status_changed", (payload) => {
  logger.info({ event: "fulfillment.status_changed", ...payload }, "Domain event: fulfillment.status_changed");
});

const DELIVERY_UPDATE_COPY: Record<string, string> = {
  shipped: "Your order is on its way!",
  delivered: "Your order has been delivered.",
};

/**
 * Delivery-update email subscriber. Only fires for statuses a buyer cares
 * about (shipped/delivered) — "unfulfilled"→"packed" is internal vendor
 * prep and not worth an email. `buyerUserId` is optional on the payload
 * because it's a best-effort lookup at emit time; if it's missing there's
 * nothing to notify, so this subscriber is a no-op rather than an error.
 */
domainEvents.onEvent("fulfillment.status_changed", (payload) => {
  const copy = DELIVERY_UPDATE_COPY[payload.status];
  if (!copy || !payload.buyerUserId) return;

  void (async () => {
    try {
      const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, payload.buyerUserId as number));
      if (!buyer) return;

      await sendEmail({
        to: buyer.email,
        subject: `Delivery update for order #${payload.orderId} — Alkemart`,
        html: `
          <p>Hi${buyer.firstName ? ` ${buyer.firstName}` : ""},</p>
          <p>${copy}</p>
          <p>Order #${payload.orderId}</p>
        `,
      });
    } catch (error) {
      logger.error({ error, event: "fulfillment.status_changed" }, "Failed to send delivery update email");
    }
  })();
});
