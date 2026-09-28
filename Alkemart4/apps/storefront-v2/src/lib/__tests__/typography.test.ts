// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const sourceRoot = fileURLToPath(new URL("../../", import.meta.url))

function components(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? components(path) : path.endsWith(".tsx") ? [path] : []
  })
}

describe("storefront reading scale", () => {
  it("uses relative sizes for readable body and secondary text", () => {
    const css = readFileSync(join(sourceRoot, "index.css"), "utf8")
    expect(css).toContain("--text-xs: 0.875rem;")
    expect(css).toContain("--text-sm: 1rem;")
    expect(css).toContain("--text-base: 1rem;")
    expect(css).not.toMatch(/(?:html|:root)\s*\{[^}]*font-size:\s*\d+px/s)
  })

  it("does not reintroduce tiny hard-coded font utilities", () => {
    const violations = components(sourceRoot).filter((path) =>
      /text-\[(?:[0-9]|1[0-5])px\]/.test(readFileSync(path, "utf8")),
    )
    expect(violations).toEqual([])
  })

  it("preserves the mobile home scale without affecting other routes", () => {
    const css = readFileSync(join(sourceRoot, "index.css"), "utf8")
    const layout = readFileSync(join(sourceRoot, "routes/__root.tsx"), "utf8")
    expect(css).toContain("@media (width < 48rem)")
    expect(css).toContain("--text-xs: 0.75rem;")
    expect(css).toContain("--text-sm: 0.875rem;")
    expect(layout).toContain('pathname === "/" ? "mobile-home-preserved"')
  })

  it("keeps fields at 16px on the compact phone home (iOS zooms smaller ones on focus)", () => {
    const css = readFileSync(join(sourceRoot, "index.css"), "utf8")
    expect(css).toMatch(/\.mobile-home-preserved :is\(input, textarea, select\) \{\s*font-size: 1rem;/)
    expect(css).not.toMatch(/user-scalable|maximum-scale/)
    const viewport = readFileSync(join(sourceRoot, "../index.html"), "utf8")
    expect(viewport).not.toMatch(/user-scalable=no|maximum-scale=1/)
  })
})
