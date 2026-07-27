import { logger } from "./logger"

export type AuditAction =
  | "seller.created"
  | "seller.updated"
  | "seller.suspended"
  | "product.created"
  | "product.updated"
  | "product.deleted"
  | "product.approved"
  | "product.rejected"
  | "order.fulfilled"
  | "order.shipped"
  | "order.refunded"
  | "payment.captured"
  | "payment.refunded"
  | "admin.login"
  | "admin.action"

export type AuditEntry = {
  action: AuditAction
  actorId: string
  actorType: "user" | "member" | "customer" | "system"
  resourceId?: string
  resourceType?: string
  details?: Record<string, unknown>
}

export function writeAuditLog(entry: AuditEntry): void {
  logger.info("audit", {
    ...entry,
    timestamp: new Date().toISOString(),
  })
}
