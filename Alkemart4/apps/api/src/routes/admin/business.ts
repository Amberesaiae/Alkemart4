import { monthsBetween } from "@alkemart/domain"
import { resolveMarket } from "@alkemart/shared/markets"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { csvResponse, currentPeriod, ordersCsv, overview, rangeRequestFrom, statementCsv, statementFor } from "../../lib/business"
import { requireAdmin } from "../../middleware/auth"

/** The seller named by ?sellerId=, or null for the whole platform. */
async function scopeOf(c: Context<AppEnv>) {
  const sellerId = c.req.query("sellerId") || null
  if (!sellerId) return { sellerId: null, seller: null }
  const seller = await c.get("authRepo").findSellerById(sellerId)
  if (!seller) throw new HTTPException(404, { message: "seller not found" })
  return { sellerId, seller }
}

const names = async (c: Context<AppEnv>) => new Map((await c.get("authRepo").listSellers().catch(() => [])).map((s) => [s.id, s.name]))

/**
 * Platform business (or one seller's, with ?sellerId=): overview for any
 * range, orders as a file, and monthly statements for the platform or a shop.
 */
export const adminBusiness = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/overview", async (c) => {
    const { sellerId, seller } = await scopeOf(c)
    return c.json({
      sellerId,
      sellerName: seller?.name ?? null,
      ...(await overview(c, { sellerId, req: rangeRequestFrom(c.req.query()), joinedAt: seller?.createdAt ?? null })),
    })
  })
  .get("/orders.csv", async (c) => {
    const { sellerId, seller } = await scopeOf(c)
    const { range, body } = await ordersCsv(c, { sellerId, req: rangeRequestFrom(c.req.query()), joinedAt: seller?.createdAt ?? null })
    return csvResponse(c, `${seller?.handle ?? "alkemart"}-orders-${range.from.toISOString().slice(0, 10)}-to-${new Date(range.to.getTime() - 1).toISOString().slice(0, 10)}.csv`, body)
  })
  .get("/statements", async (c) => {
    const { sellerId, seller } = await scopeOf(c)
    const scope = sellerId ? "seller" : "platform"
    const sellers = seller ? [] : await c.get("authRepo").listSellers().catch(() => [])
    const start = seller?.createdAt ?? sellers.reduce<Date>((m, s) => (s.createdAt < m ? s.createdAt : m), new Date())
    const closed = new Map((await c.get("statements").list(scope, sellerId)).map((s) => [s.period, s]))
    const open = currentPeriod()
    return c.json({
      scope,
      months: monthsBetween(start, new Date(), resolveMarket().utcOffsetMinutes).map((period) => ({
        period,
        status: period === open ? "open" : "closed",
        closedAt: closed.get(period)?.closedAt.toISOString() ?? null,
      })),
    })
  })
  .get("/statements/:period", async (c) => {
    const { sellerId } = await scopeOf(c)
    return c.json({ statement: await statementFor(c, sellerId ? "seller" : "platform", sellerId, c.req.param("period")) })
  })
  .get("/statements/:period/csv", async (c) => {
    const { sellerId, seller } = await scopeOf(c)
    const view = await statementFor(c, sellerId ? "seller" : "platform", sellerId, c.req.param("period"))
    return csvResponse(c, `${seller?.handle ?? "alkemart-platform"}-statement-${view.period}.csv`, statementCsv(view, await names(c)))
  })
