import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { CatalogConflictError, CatalogValidationError } from "../../catalog-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const ProposeBody = z.object({
  term: z.string().trim().min(1).max(120),
  target: z.string().trim().min(1).max(200),
  type: z.enum(["synonym", "redirect"]),
})

const ReviewBody = z.object({ decision: z.enum(["approved", "rejected"]) })

function mapAliasError(err: unknown): never {
  if (err instanceof CatalogValidationError) {
    throw new HTTPException(400, { message: err.message })
  }
  if (err instanceof CatalogConflictError) {
    throw new HTTPException(409, { message: err.message })
  }
  throw err
}

/**
 * Admin search-vocabulary governance (Phase 2C) + quality telemetry (2D).
 * Seller words become global synonyms/redirects only after review here.
 */
export const adminAliases = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const statusRaw = c.req.query("status")?.trim()
    const status =
      statusRaw === "proposed" || statusRaw === "approved" || statusRaw === "rejected"
        ? statusRaw
        : undefined
    return c.json({ items: await c.get("repo").listSearchAliases(status) })
  })
  .post("/", async (c) => {
    const parsed = ProposeBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const alias = await c
        .get("repo")
        .proposeSearchAlias(parsed.data.term, parsed.data.target, parsed.data.type)
      return c.json({ alias }, 201)
    } catch (err) {
      mapAliasError(err)
    }
  })
  .post("/:id/review", async (c) => {
    const parsed = ReviewBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const alias = await c
        .get("repo")
        .reviewSearchAlias(c.req.param("id"), parsed.data.decision, c.get("auth").userId)
      if (!alias) throw new HTTPException(404, { message: "alias not found" })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: `alias.${parsed.data.decision}`,
        targetType: "search_alias",
        targetId: alias.id,
        detail: { term: alias.term, target: alias.target },
      })
      return c.json({ alias })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapAliasError(err)
    }
  })

/** Search operations: projection freshness + zero-result queue (Phase 2A/2D). */
export const adminSearch = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/status", async (c) => {
    const repo = c.get("repo")
    const [outbox, aliases, zeroResultSample] = await Promise.all([
      repo.outboxStatus(),
      repo.listSearchAliases(),
      repo.listZeroResultQueries(5),
    ])
    return c.json({
      outboxPending: outbox.pending,
      outboxLastAt: outbox.lastAt,
      aliasesProposed: aliases.filter((a) => a.status === "proposed").length,
      aliasesApproved: aliases.filter((a) => a.status === "approved").length,
      zeroResultSample,
    })
  })
  .get("/zero-result", async (c) => {
    const rawLimit = Number(c.req.query("limit") ?? 20)
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.trunc(rawLimit))) : 20
    return c.json({ items: await c.get("repo").listZeroResultQueries(limit) })
  })
