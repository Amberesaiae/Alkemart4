/**
 * Ensure every vendor-created product gets a product_seller row for the
 * creating seller. Mercur only links when product.seller_ids is set; Seller Hub
 * often omits it → products stay "unrestricted" and appear in every shop's list
 * under Mercur's shared-catalog filter.
 */
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"
import { createProductsWorkflow } from "@mercurjs/core/workflows"
import { invalidateSellerOwnedProductIds } from "../../lib/seller-owned-products-cache"

type ProductsCreated = {
  products?: Array<{ id?: string }>
  additional_data?: { seller_id?: string }
  input?: {
    created_by?: string
    additional_data?: { seller_id?: string }
    products?: Array<{ seller_ids?: string[] }>
  }
}

;(createProductsWorkflow.hooks as { productsCreated: (fn: unknown) => void })
  .productsCreated(
    async (
      args: ProductsCreated,
      { container }: { container: { resolve: (k: string) => unknown } },
    ) => {
      const list = args.products || []
      if (!list.length) return

      let sellerId =
        args.additional_data?.seller_id ||
        args.input?.additional_data?.seller_id ||
        args.input?.created_by ||
        args.input?.products?.flatMap((p) => p.seller_ids || []).find(Boolean) ||
        ""

      const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
        graph: (args: unknown) => Promise<{ data: unknown }>
      }
      const link = container.resolve(ContainerRegistrationKeys.LINK) as {
        create: (data: unknown) => Promise<unknown>
      }

      if (!sellerId) {
        try {
          const ids = list.map((p) => p.id).filter(Boolean) as string[]
          const { data: actions } = await query.graph({
            entity: "product_change_action",
            fields: ["product_id", "product_change.created_by"],
            filters: { product_id: ids },
          })
          const rows = Array.isArray(actions)
            ? actions
            : actions
              ? [actions]
              : []
          for (const row of rows) {
            const cb = (row as { product_change?: { created_by?: string } })
              ?.product_change?.created_by
            if (cb) {
              sellerId = cb
              break
            }
          }
        } catch {
          /* continue */
        }
      }

      if (!sellerId) return

      const links: Array<Record<string, { product_id?: string; seller_id?: string }>> =
        []

      for (const p of list) {
        if (!p.id) continue
        try {
          const { data: existing } = await query.graph({
            entity: "product_seller",
            fields: ["product_id", "seller_id"],
            filters: { product_id: p.id, seller_id: sellerId },
          })
          const has = Array.isArray(existing)
            ? existing.length > 0
            : Boolean(existing)
          if (has) continue
        } catch {
          /* try create anyway */
        }
        links.push({
          [Modules.PRODUCT]: { product_id: p.id },
          [MercurModules.SELLER]: { seller_id: sellerId },
        })
      }

      if (!links.length) {
        // Still drop ownership cache so list reflects any concurrent link
        void invalidateSellerOwnedProductIds(sellerId)
        return
      }
      try {
        await link.create(links)
        void invalidateSellerOwnedProductIds(sellerId)
      } catch (e) {
        console.error(
          "[alkemart] product_seller link failed",
          sellerId,
          e instanceof Error ? e.message : e,
        )
        void invalidateSellerOwnedProductIds(sellerId)
      }
    },
  )
