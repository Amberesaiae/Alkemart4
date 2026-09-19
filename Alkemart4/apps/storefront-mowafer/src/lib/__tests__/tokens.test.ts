import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("mowafer tokens", () => {
  const css = readFileSync(resolve(import.meta.dirname, "../../styles/index.css"), "utf8")

  it("defines primary yellow and dark ink", () => {
    expect(css).toMatch(/--primary:\s*#febf31/i)
    expect(css).toMatch(/--foreground:\s*#3c3c3b/i)
  })

  it("defines department accents", () => {
    expect(css).toMatch(/--dept-electronics:\s*#50d1c8/i)
    expect(css).toMatch(/--dept-home-pet:\s*#f0295a/i)
    expect(css).toMatch(/--dept-beverages:\s*#9ac63b/i)
  })

  it("bans cream primary washes in CSS comments contract", () => {
    expect(css).toMatch(/no bg-primary\/N/i)
  })
})
