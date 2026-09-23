import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const Status = z.enum(["draft", "running", "paused", "ended"])

const CreateBody = z.object({
  key: z.string().trim().min(3).max(64),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  controlPct: z.number().int().min(0).max(100).optional(),
  primaryMetric: z.string().trim().min(1).max(120).optional().nullable(),
  guardrails: z.unknown().optional(),
})

const PatchBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    controlPct: z.number().int().min(0).max(100).optional(),
    primaryMetric: z.string().trim().min(1).max(120).optional().nullable(),
    guardrails: z.unknown().optional(),
    status: Status.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

function mapExperimentError(err: unknown): never {
  throw new HTTPException(400, { message: err instanceof Error ? err.message : "invalid experiment" })
}

/**
 * Phase 7D — experiment registry. Ranking/layout tests only — assignment
 * is deterministic per (experiment, unit) with logged exposure, and the
 * control bucket is the holdout that never sees the change. Metric
 * attribution to delivered orders rides Phase 7 journeys; until checkout
 * carries experiment tags, reports read exposures, and guardrail review
 * stays a human step before any rollout.
 */
export const adminExperiments = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const raw = c.req.query("status")
    const status = raw === "draft" || raw === "running" || raw === "paused" || raw === "ended" ? raw : undefined
    const items = await c.get("checkoutRepo").listExperiments(status)
    return c.json({
      items: items.map((e) => ({
        id: e.id,
        key: e.key,
        name: e.name,
        status: e.status,
        controlPct: e.controlPct,
        primaryMetric: e.primaryMetric,
      })),
    })
  })
  .post("/", async (c) => {
    const parsed = CreateBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const experiment = await c.get("checkoutRepo").createExperiment({
        ...parsed.data,
        createdBy: c.get("auth").userId,
      })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "experiment.create",
        targetType: "experiment",
        targetId: experiment.id,
        detail: { key: experiment.key },
      })
      return c.json({ experiment }, 201)
    } catch (err) {
      mapExperimentError(err)
    }
  })
  .get("/:id", async (c) => {
    const experiment = await c.get("checkoutRepo").getExperiment(c.req.param("id"))
    if (!experiment) throw new HTTPException(404, { message: "experiment not found" })
    const report = await c.get("checkoutRepo").reportExperiment(experiment.id)
    return c.json({ experiment, report })
  })
  .patch("/:id", async (c) => {
    const parsed = PatchBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const experiment = await c.get("checkoutRepo").updateExperiment(c.req.param("id"), parsed.data)
      if (!experiment) throw new HTTPException(404, { message: "experiment not found" })
      return c.json({ experiment })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapExperimentError(err)
    }
  })
