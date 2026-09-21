import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { CatalogConflictError, CatalogValidationError } from "../../catalog-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const ReviewBody = z.object({ decision: z.enum(["confirmed", "rejected"]) })

function mapMatchError(err: unknown): never {
  if (err instanceof CatalogValidationError) {
    throw new HTTPException(400, { message: err.message })
  }
  if (err instanceof CatalogConflictError) {
    throw new HTTPException(409, { message: err.message })
  }
  throw err
}

/**
 * Admin product-match review queue (Phase 1D / ADR-002).
 * Confirmation promotes both sides to `matched`; rejection is terminal.
 */
export const adminMatches = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const statusRaw = c.req.query("status")?.trim()
    const status =
      statusRaw === "proposed" || statusRaw === "confirmed" || statusRaw === "rejected"
        ? statusRaw
        : undefined
    return c.json({ items: await c.get("repo").listMatchCandidates(status) })
  })
  .post("/:id/review", async (c) => {
    const parsed = ReviewBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const candidate = await c
        .get("repo")
        .reviewMatchCandidate(c.req.param("id"), parsed.data.decision, c.get("auth").userId)
      if (!candidate) throw new HTTPException(404, { message: "match candidate not found" })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: `match.${parsed.data.decision}`,
        targetType: "product_match",
        targetId: candidate.id,
        detail: { productId: candidate.productId, candidateProductId: candidate.candidateProductId },
      })
      return c.json({ candidate })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapMatchError(err)
    }
  })
