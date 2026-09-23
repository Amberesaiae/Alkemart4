import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"

/**
 * Phase 7D public assignment. The unit id is a client-generated opaque
 * token (localStorage), never identity: buckets stay stable per unit and
 * exposure is logged once for reporting.
 */
export const storeExperiments = new Hono<AppEnv>().get("/assign", async (c) => {
  const experiment = c.req.query("experiment")?.trim()
  const unit = c.req.query("unit")?.trim()
  if (!experiment || !unit) throw new HTTPException(400, { message: "experiment and unit required" })
  if (unit.length > 128) throw new HTTPException(400, { message: "unit too long" })
  const assigned = await c.get("checkoutRepo").assignExperiment(experiment, unit)
  if (!assigned) throw new HTTPException(404, { message: "experiment not found" })
  return c.json({ experimentId: assigned.experimentId, bucket: assigned.bucket })
})
