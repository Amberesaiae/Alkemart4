/**
 * POST /admin/search/reindex — full product reindex into Meilisearch.
 * Authenticated admin only (Medusa admin middleware on /admin/*).
 * UI label recommendation: "Search sync" (not engine marketing name).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reindexAllProducts, searchHealth } from "../../../../lib/search/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const health = await searchHealth()
  if (!health.enabled) {
    res.status(400).json({
      error:
        "Search is not configured. Set MEILISEARCH_HOST (and MEILISEARCH_API_KEY) on the API.",
      health,
    })
    return
  }
  if (!health.reachable) {
    res.status(503).json({
      error: "Search engine unreachable",
      health,
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const result = await reindexAllProducts(query)
    res.status(200).json({
      ok: true,
      indexed: result.indexed,
      health,
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Reindex failed",
    })
  }
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const health = await searchHealth()
  res.status(200).json(health)
}
