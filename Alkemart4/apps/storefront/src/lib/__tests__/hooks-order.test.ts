// @vitest-environment node
// Scans source files off disk rather than rendering anything, so it needs real
// Node module resolution — under the suite-wide happy-dom environment
// `import.meta.url` becomes a /@fs/ URL and the source root resolves wrong.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Rules-of-Hooks guard: no component may call a hook after a conditional
 * early return at the top level — the hook count then varies between renders
 * and React crashes with minified error #310. Regression test for the
 * HomeFeaturedShop / NotifyMeBlock crashes (data arriving flips the early
 * return, the hook below appears mid-life).
 */
function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue
      out.push(...tsxFiles(path))
    } else if (entry.endsWith(".tsx")) {
      out.push(path)
    }
  }
  return out
}

function violationsIn(source: string): string[] {
  const lines = source.split("\n")
  // Split top-level function blocks; only PascalCase blocks are components.
  const starts: number[] = []
  lines.forEach((l, i) => {
    if (/^(export |async )?function \w+/.test(l) || /^export const [A-Za-z]\w* =/.test(l)) {
      starts.push(i)
    }
  })
  starts.push(lines.length)
  const found: string[] = []
  for (let b = 0; b < starts.length - 1; b += 1) {
    const first = lines[starts[b]] ?? ""
    const name = first.match(/function (\w+)|const (\w+) =/)?.slice(1).find(Boolean) ?? ""
    if (!/^[A-Z]/.test(name)) continue
    const block = lines.slice(starts[b], starts[b + 1])
    const earlyReturnAt = block.findIndex((l) => /^  (if .* return (null|false);?|return (null|false);?)$/.test(l.trimEnd()))
    if (earlyReturnAt === -1) continue
    block.forEach((l, i) => {
      if (i > earlyReturnAt && /^  (const .* = )?use[A-Z]\w*\(/.test(l)) {
        found.push(`${name}: early return line ${starts[b] + earlyReturnAt + 1}, hook line ${starts[b] + i + 1} (${l.trim().slice(0, 50)})`)
      }
    })
  }
  return found
}

describe("rules of hooks (static)", () => {
  it("has no hooks after conditional early returns", () => {
    const root = new URL("../../../", import.meta.url).pathname
    const bad: string[] = []
    for (const f of tsxFiles(root + "src")) {
      for (const v of violationsIn(readFileSync(f, "utf8"))) {
        bad.push(`${f.replace(root, "")}: ${v}`)
      }
    }
    expect(bad).toEqual([])
  })
})
