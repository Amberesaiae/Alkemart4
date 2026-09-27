import { monthsBetween } from "@alkemart/domain"
import { resolveMarket } from "@alkemart/shared/markets"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { csvResponse, currentPeriod, ordersCsv, overview, rangeRequestFrom, statementCsv, statementFor } from "../../lib/business"
import { requireSeller } from "../../middleware/auth"

/**
 * The seller's own business: overview for any range, the orders behind it as
 * a file, and monthly statements (frozen once the month ends).
 */
export const vendorBusiness = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/overview", async (c) => {
    const sellerId = c.get("auth").sellerId!
    const seller = await c.get("authRepo").findSellerById(sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    return c.json({ joinedAt: seller.createdAt.toISOString(), ...(await overview(c, { sellerId, req: rangeRequestFrom(c.req.query()), joinedAt: seller.createdAt })) })
  })
  .get("/orders.csv", async (c) => {
    const sellerId = c.get("auth").sellerId!
    const seller = await c.get("authRepo").findSellerById(sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    const { range, body } = await ordersCsv(c, { sellerId, req: rangeRequestFrom(c.req.query()), joinedAt: seller.createdAt })
    return csvResponse(c, `${seller.handle}-orders-${range.from.toISOString().slice(0, 10)}-to-${new Date(range.to.getTime() - 1).toISOString().slice(0, 10)}.csv`, body)
  })
  .get("/statements", async (c) => {
    const sellerId = c.get("auth").sellerId!
    const seller = await c.get("authRepo").findSellerById(sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    const closed = new Map((await c.get("statements").list("seller", sellerId)).map((s) => [s.period, s]))
    const months = monthsBetween(seller.createdAt, new Date(), resolveMarket().utcOffsetMinutes)
    const open = currentPeriod()
    return c.json({
      months: months.map((period) => ({
        period,
        status: period === open ? "open" : "closed",
        closedAt: closed.get(period)?.closedAt.toISOString() ?? null,
      })),
    })
  })
  .get("/statements/:period", async (c) => {
    const sellerId = c.get("auth").sellerId!
    return c.json({ statement: await statementFor(c, "seller", sellerId, c.req.param("period")) })
  })
  .get("/statements/:period/csv", async (c) => {
    const sellerId = c.get("auth").sellerId!
    const seller = await c.get("authRepo").findSellerById(sellerId)
    const view = await statementFor(c, "seller", sellerId, c.req.param("period"))
    return csvResponse(c, `${seller?.handle ?? "shop"}-statement-${view.period}.csv`, statementCsv(view, new Map([[sellerId, seller?.name ?? sellerId]])))
  })
