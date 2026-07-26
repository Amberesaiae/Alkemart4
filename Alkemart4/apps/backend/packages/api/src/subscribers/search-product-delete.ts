import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { isSearchEnabled } from "../lib/search/client"
import { deleteProductDocuments } from "../lib/search/service"
import { logger } from "../lib/logger"

export default async function searchProductDelete({
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  if (!isSearchEnabled()) return
  const id = data?.id
  if (!id) return

  try {
    await deleteProductDocuments([id])
  } catch (e) {
    logger.error("[search] product delete failed", {
      id,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export const config: SubscriberConfig = {
  event: "product.deleted",
}
