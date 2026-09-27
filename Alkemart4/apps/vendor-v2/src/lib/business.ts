/** Business overview and statements — mirrors apps/api/src/routes/vendor/business.ts. */
import { rangeQuery, type BusinessOverview, type RangeValue, type Statement, type StatementMonth } from "@workspace/console-ui/lib/business"
import { api, download } from "./http"

export const getOverview = (range: RangeValue) => api<BusinessOverview>(`/vendor/business/overview?${rangeQuery(range)}`)

export const downloadOrders = (range: RangeValue) => download(`/vendor/business/orders.csv?${rangeQuery(range)}`)

export const listStatements = () => api<{ months: StatementMonth[] }>("/vendor/business/statements").then((r) => r.months)

export const getStatement = (period: string) => api<{ statement: Statement }>(`/vendor/business/statements/${period}`).then((r) => r.statement)

export const downloadStatement = (period: string) => download(`/vendor/business/statements/${period}/csv`)
