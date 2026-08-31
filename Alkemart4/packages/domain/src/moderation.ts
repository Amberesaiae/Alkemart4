import type { ProductStatus } from "./sellable"

export type ModerationAction = "propose" | "approve" | "reject" | "request_changes"

export class InvalidModerationTransitionError extends Error {
  readonly from: ProductStatus
  readonly action: ModerationAction

  constructor(from: ProductStatus, action: ModerationAction) {
    super(`cannot ${action} product in status ${from}`)
    this.name = "InvalidModerationTransitionError"
    this.from = from
    this.action = action
  }
}

/** Vendor submit / re-submit for admin review (including post-publish re-moderation). */
export function proposeProduct(status: ProductStatus): ProductStatus {
  void status
  return "proposed"
}

/** Admin approve — only from proposed. */
export function approveProduct(status: ProductStatus): ProductStatus {
  if (status !== "proposed") {
    throw new InvalidModerationTransitionError(status, "approve")
  }
  return "published"
}

/** Admin reject — only from proposed. */
export function rejectProduct(status: ProductStatus): ProductStatus {
  if (status !== "proposed") {
    throw new InvalidModerationTransitionError(status, "reject")
  }
  return "rejected"
}

/** Admin request-changes — stays proposed. */
export function requestProductChanges(status: ProductStatus): ProductStatus {
  if (status !== "proposed") {
    throw new InvalidModerationTransitionError(status, "request_changes")
  }
  return "proposed"
}
