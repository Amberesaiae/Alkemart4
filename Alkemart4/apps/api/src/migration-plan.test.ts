import { describe, expect, it } from "vitest"
import { isMigrationFile, pendingMigrations } from "@alkemart/db"

describe("migration runner (pure)", () => {
  it("selects only unapplied .sql files in order", () => {
    expect(
      pendingMigrations(["0000_sleepy_post", "0027_product_slugs"], [
        "0000_sleepy_post.sql",
        "0027_product_slugs.sql",
        "0028_catalog_slice_indexes.sql",
        "meta",
        "_journal.json",
        "README.md",
      ]),
    ).toEqual(["0028_catalog_slice_indexes"])
  })

  it("is empty when everything is applied", () => {
    expect(pendingMigrations(["a", "b"], ["b.sql", "a.sql"])).toEqual([])
  })

  it("recognizes migration files", () => {
    expect(isMigrationFile("0030_ledger_and_currency.sql")).toBe(true)
    expect(isMigrationFile("meta")).toBe(false)
    expect(isMigrationFile("notes.txt")).toBe(false)
  })
})
