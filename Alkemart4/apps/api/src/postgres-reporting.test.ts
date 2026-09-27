import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { describe, expect, it, vi } from "vitest"
import { PostgresCheckoutRepository } from "./postgres-checkout-repository"

// Exercise real Drizzle query compilation at the postgres-js boundary without
// connecting to a database. Raw SQL Date parameters bypass column encoders.
function reportingRepository() {
  const client = postgres({ max: 1 })
  const unsafe = vi.spyOn(client, "unsafe").mockImplementation((_query, params) => {
    if (params?.some((value) => value instanceof Date)) {
      throw new TypeError("Unencoded Date reached postgres-js")
    }
    return { values: async () => [] } as unknown as ReturnType<typeof client.unsafe>
  })
  return { repo: new PostgresCheckoutRepository(drizzle(client)), unsafe }
}

describe("Postgres reporting timestamp parameters", () => {
  const from = new Date("2026-08-01T00:00:00.000Z")
  const to = new Date("2026-09-28T00:00:00.000Z")

  it("encodes both bounds of the overview's placed-order range", async () => {
    const { repo, unsafe } = reportingRepository()
    await expect(repo.listOrderFacts({ placedFrom: from, placedTo: to })).resolves.toEqual([])
    expect(unsafe.mock.calls[0]?.[1]).toEqual([from.toISOString(), to.toISOString()])
  })

  it("encodes both bounds of statement delivery ranges", async () => {
    const { repo, unsafe } = reportingRepository()
    await expect(repo.listOrderFacts({ deliveredFrom: from, deliveredTo: to })).resolves.toEqual([])
    expect(unsafe.mock.calls[0]?.[1]).toEqual([from.toISOString(), to.toISOString()])
  })

  it("encodes the statement payout range", async () => {
    const { repo, unsafe } = reportingRepository()
    await expect(repo.listPayoutFacts({ paidFrom: from, paidTo: to })).resolves.toEqual([])
    expect(unsafe.mock.calls[0]?.[1]).toEqual([from.toISOString(), to.toISOString()])
  })

  it("encodes the return deadline used by the escalation sweep", async () => {
    const { repo, unsafe } = reportingRepository()
    await expect(repo.listReturnCases({ dueAt: to })).resolves.toEqual([])
    expect(unsafe.mock.calls[0]?.[1]).toContain(to.toISOString())
  })
})
