import * as Sentry from "@sentry/node"
import { logger } from "./logger"

let initialized = false

export function initSentry() {
  if (initialized) return
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    logger.info("[sentry] SENTRY_DSN not set — skipping initialization")
    return
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  })
  initialized = true
  logger.info("[sentry] initialized")
}

export function captureError(err: Error, context?: Record<string, unknown>) {
  if (!initialized) return
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context)
    Sentry.captureException(err)
  })
}
