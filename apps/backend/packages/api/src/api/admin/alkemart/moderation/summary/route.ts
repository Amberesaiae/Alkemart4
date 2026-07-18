/**
 * GET /admin/alkemart/moderation/summary
 * Lightweight queue counts for Admin banners / ops home.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const [sellersRes, productsRes] = await Promise.all([
      query.graph({
        entity: "seller",
        fields: ["id", "status", "approved_at"],
      }),
      query.graph({
        entity: "product",
        fields: ["id", "status"],
        filters: { status: "proposed" },
      }),
    ])

    const sellers = asList(sellersRes.data)
    const pending_sellers = sellers.filter(
      (s) => String(s.status || "").toLowerCase() === "pending_approval",
    ).length
    const rejected_applications = sellers.filter(
      (s) =>
        String(s.status || "").toLowerCase() === "suspended" && !s.approved_at,
    ).length
    const proposed_products = asList(productsRes.data).length

    res.status(200).json({
      pending_sellers,
      rejected_applications,
      proposed_products,
      queues: {
        sellers: "/sellers-queue",
        products: "/product-moderation",
      },
      generated_at: new Date().toISOString(),
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Summary failed",
    })
  }
}
