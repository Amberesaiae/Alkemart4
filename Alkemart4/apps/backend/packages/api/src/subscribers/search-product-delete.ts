import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { isSearchEnabled } from "../lib/search/client"
import { deleteProductDocuments } from "../lib/search/service"

export default async function searchProductDelete({
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  if (!isSearchEnabled()) return
  const id = data?.id
  if (!id) return

  try {
    await deleteProductDocuments([id])
  } catch (e) {
    console.error(
      "[search] product delete failed",
      id,
      e instanceof Error ? e.message : e,
    )
  }
}

export const config: SubscriberConfig = {
  event: "product.deleted",
}
