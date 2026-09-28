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
  it("reserves one scrollbar gutter across routes and modal scroll locks", () => {
    const css = readFileSync(join(sourceRoot, "index.css"), "utf8")
    expect(css).toContain("scrollbar-gutter: stable;")
    expect(css).toMatch(/body\[data-scroll-locked\]\s*\{\s*margin-right: 0 !important;/)
  })
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

  it("shares the compact mobile scale across routes and portalled controls", () => {
    const css = readFileSync(join(sourceRoot, "index.css"), "utf8")
    expect(css).toMatch(/@media \(width < 48rem\) \{\s*:root \{/)
    expect(css).toContain("--text-xs: 0.75rem;")
    expect(css).toContain("--text-sm: 0.875rem;")
    expect(css).not.toMatch(/\.mobile-home-preserved\s*\{[^}]*--text-/s)
  })

  it("keeps fields at 16px on all phone routes (iOS zooms smaller ones on focus)", () => {
    const css = readFileSync(join(sourceRoot, "index.css"), "utf8")
    expect(css).toMatch(/:is\(input, textarea, select, \[data-slot="select-trigger"\]\) \{\s*font-size: 1rem;/)
    expect(css).not.toMatch(/user-scalable|maximum-scale/)
    const viewport = readFileSync(join(sourceRoot, "../index.html"), "utf8")
    expect(viewport).not.toMatch(/user-scalable=no|maximum-scale=1/)
  })
})
