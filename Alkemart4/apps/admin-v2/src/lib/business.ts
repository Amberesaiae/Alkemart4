/** Platform (or one seller's) business — mirrors apps/api/src/routes/admin/business.ts. */
import { rangeQuery, type BusinessOverview, type RangeValue, type Statement, type StatementMonth } from "@workspace/console-ui/lib/business"
import { api, download } from "./http"

const seller = (sellerId: string | null) => (sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : "")

export const getOverview = (range: RangeValue, sellerId: string | null) =>
  api<BusinessOverview & { sellerId: string | null }>(`/admin/business/overview?${rangeQuery(range, { sellerId })}`)

export const downloadOrders = (range: RangeValue, sellerId: string | null) => download(`/admin/business/orders.csv?${rangeQuery(range, { sellerId })}`)

export const listStatements = (sellerId: string | null) =>
  api<{ scope: "seller" | "platform"; months: StatementMonth[] }>(`/admin/business/statements${seller(sellerId)}`).then((r) => r.months)

export const getStatement = (period: string, sellerId: string | null) =>
  api<{ statement: Statement }>(`/admin/business/statements/${period}${seller(sellerId)}`).then((r) => r.statement)

export const downloadStatement = (period: string, sellerId: string | null) => download(`/admin/business/statements/${period}/csv${seller(sellerId)}`)
