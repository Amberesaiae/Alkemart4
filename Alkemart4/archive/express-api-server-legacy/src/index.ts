import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { startOutboxWorker, stopOutboxWorker } from "./lib/outbox";
import { sweepAbandonedPayments, sweepOrphanIntents } from "./lib/checkout";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Unhandled errors ───────────────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

// ── Start server ───────────────────────────────────────────────────────────
const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start background workers.
  startOutboxWorker();

  // Abandonment sweeper: runs every 60s.
  setInterval(() => {
    void sweepAbandonedPayments().catch((err) => {
      logger.error({ err }, "Abandonment sweep error");
    });
  }, 60_000);

  // Orphan recovery: runs every 120s.
  setInterval(() => {
    void sweepOrphanIntents().catch((err) => {
      logger.error({ err }, "Orphan intent sweep error");
    });
  }, 120_000);

  // Session cleanup: runs every 30 minutes.
  setInterval(() => {
    void cleanupSessions().catch((err) => {
      logger.error({ err }, "Session cleanup error");
    });
  }, 30 * 60_000);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down gracefully");

  stopOutboxWorker();
  server.close(() => {
    logger.info("HTTP server closed");
  });

  try {
    await pool.end();
    logger.info("Database pool closed");
  } catch {
    // ignore
  }

  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// ── Session cleanup worker ─────────────────────────────────────────────────
async function cleanupSessions(): Promise<void> {
  const { db, sessionsTable } = await import("@workspace/db");
  const { lt } = await import("drizzle-orm");

  const result = await db
    .delete(sessionsTable)
    .where(lt(sessionsTable.expiresAt, new Date()))
    .returning({ id: sessionsTable.id });

  if (result.length > 0) {
    logger.info({ count: result.length }, "Cleaned up expired sessions");
  }
}
