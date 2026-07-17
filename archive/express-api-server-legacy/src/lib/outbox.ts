import { and, eq, isNull, sql } from "drizzle-orm";
import { db, domainEventOutboxTable } from "@workspace/db";
import type { DomainEventName } from "@workspace/db";
import { logger } from "./logger";
import { OUTBOX_ENABLED } from "./platform-config";

/**
 * Insert a domain event into the outbox within the current transaction.
 * Called from the same DB transaction as the business operation (e.g. order confirm).
 * When outbox is disabled, falls back to the in-process EventEmitter.
 */
export async function emitToOutbox(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  eventName: DomainEventName,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!OUTBOX_ENABLED) return; // EventEmitter handles it when outbox is off.

  await tx.insert(domainEventOutboxTable).values({
    eventName,
    payload,
  });
}

/**
 * Process pending outbox events with SKIP LOCKED for multi-instance safety.
 * Each event is delivered to registered handlers. Failures are retried with
 * exponential backoff up to MAX_ATTEMPTS, then left as poison for ops alerting.
 */
const MAX_ATTEMPTS = 10;
const BACKOFF_BASE_MS = 30_000; // 30s

type EventHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<DomainEventName, EventHandler[]>();

export function registerOutboxHandler(eventName: DomainEventName, handler: EventHandler): void {
  const list = handlers.get(eventName) ?? [];
  list.push(handler);
  handlers.set(eventName, list);
}

let running = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the outbox polling worker. Call once at server boot.
 */
export function startOutboxWorker(intervalMs = 5_000): void {
  if (!OUTBOX_ENABLED) {
    logger.info("Outbox worker disabled (OUTBOX_ENABLED=false)");
    return;
  }
  if (running) return;
  running = true;
  logger.info({ intervalMs }, "Starting outbox worker");
  pollTimer = setInterval(() => {
    void processBatch();
  }, intervalMs);
}

export function stopOutboxWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  running = false;
}

async function processBatch(): Promise<void> {
  try {
    // Fetch up to 10 unprocessed events, locked with SKIP LOCKED.
    const events = await db
      .select()
      .from(domainEventOutboxTable)
      .where(
        and(
          isNull(domainEventOutboxTable.processedAt),
          sql`${domainEventOutboxTable.nextAttemptAt} <= now()`,
        ),
      )
      .orderBy(domainEventOutboxTable.id)
      .limit(10)
      .for("update", { skipLocked: true });

    for (const event of events) {
      await processEvent(event);
    }
  } catch (err) {
    logger.error({ err }, "Outbox batch processing error");
  }
}

async function processEvent(event: typeof domainEventOutboxTable.$inferSelect): Promise<void> {
  const eventHandlers = handlers.get(event.eventName as DomainEventName) ?? [];
  if (eventHandlers.length === 0) {
    // No handlers registered — mark as processed.
    await db
      .update(domainEventOutboxTable)
      .set({ processedAt: new Date(), attempts: event.attempts + 1 })
      .where(eq(domainEventOutboxTable.id, event.id));
    return;
  }

  try {
    for (const handler of eventHandlers) {
      await handler(event.payload as Record<string, unknown>);
    }
    await db
      .update(domainEventOutboxTable)
      .set({ processedAt: new Date(), attempts: event.attempts + 1 })
      .where(eq(domainEventOutboxTable.id, event.id));
  } catch (err) {
    const attempts = event.attempts + 1;
    const backoffMs = BACKOFF_BASE_MS * Math.pow(2, Math.min(attempts, 5));
    const nextAttemptAt = new Date(Date.now() + backoffMs);

    if (attempts >= MAX_ATTEMPTS) {
      logger.error(
        { eventId: event.id, eventName: event.eventName, attempts, error: err },
        "Outbox event reached max attempts — poison",
      );
      // Leave processedAt null with capped attempts for ops alerting.
      await db
        .update(domainEventOutboxTable)
        .set({ attempts, lastError: String(err), nextAttemptAt })
        .where(eq(domainEventOutboxTable.id, event.id));
    } else {
      logger.warn(
        { eventId: event.id, eventName: event.eventName, attempts, nextAttemptAt },
        "Outbox event failed — will retry",
      );
      await db
        .update(domainEventOutboxTable)
        .set({ attempts, lastError: String(err), nextAttemptAt })
        .where(eq(domainEventOutboxTable.id, event.id));
    }
  }
}
