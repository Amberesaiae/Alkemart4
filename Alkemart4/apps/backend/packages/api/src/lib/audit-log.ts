import { logger } from "./logger.ts"

export type AuditAction =
  | "seller.created"
  | "seller.updated"
  | "seller.suspended"
  | "seller.approved"
  | "product.created"
  | "product.updated"
  | "product.deleted"
  | "product.approved"
  | "product.rejected"
  | "product.unpublished"
  | "order.fulfilled"
  | "order.shipped"
  | "order.canceled"
  | "order.refunded"
  | "return.approved"
  | "return.rejected"
  | "dispute.resolved"
  | "payment.captured"
  | "payment.refunded"
  | "payout.triggered"
  | "admin.login"
  | "admin.action"

export type AuditEntry = {
  action: AuditAction
  actorId: string
  actorType: "user" | "member" | "customer" | "seller" | "system"
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
