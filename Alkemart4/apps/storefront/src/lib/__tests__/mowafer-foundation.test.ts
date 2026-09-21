import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const css = readFileSync(resolve(__dirname, "../../styles/index.css"), "utf8")
const html = readFileSync(resolve(__dirname, "../../../index.html"), "utf8")

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
  if (!match) throw new Error(`Missing token --${name}`)
  return match[1].toLowerCase()
}

describe("MOWAFER-aligned Alkemart foundation", () => {
  it("uses the canonical brand yellow and ink", () => {
    expect(token("primary")).toBe("#febf31")
    expect(token("ink")).toBe("#3c3c3b")
    expect(token("foreground")).toBe("#3c3c3b")
  })

  it("uses Montserrat as the single storefront family", () => {
    expect(css).toMatch(/--font-sans:\s*"Montserrat"/)
    expect(html).toContain("family=Montserrat")
    expect(html).not.toContain("family=Sora")
  })

  it("keeps the captured MOWAFER department identity colours", () => {
    expect(css).toMatch(/theme-dept-electronics[\s\S]*?--dept-bg:\s*#66d1c8/i)
    expect(css).toMatch(/theme-dept-food[\s\S]*?--dept-bg:\s*#fcbf31/i)
    expect(css).toMatch(/theme-dept-pet[\s\S]*?--dept-bg:\s*#f03351/i)
    expect(css).toMatch(/theme-dept-beverages[\s\S]*?--dept-bg:\s*#aace3b/i)
    expect(css).toMatch(/theme-dept-baby[\s\S]*?--dept-bg:\s*#e7e4e3/i)
  })

  it("defines the canonical composition rhythm", () => {
    expect(css).toMatch(/--space-control:\s*0\.5rem/)
    expect(css).toMatch(/--space-component:\s*1rem/)
    expect(css).toMatch(/--space-section:\s*1\.5rem/)
    expect(css).toMatch(/--space-page-mobile:\s*2rem/)
    expect(css).toMatch(/--space-page-desktop:\s*3rem/)
  })
})
