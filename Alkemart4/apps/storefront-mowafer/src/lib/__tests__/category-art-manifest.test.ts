import { readdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { CATEGORY_ART } from "@alkemart/shared/category-art"

const DIR = resolve(import.meta.dirname, "../../../public/images/categories")
const BUDGET = 300 * 1024

describe("category art mirror manifest", () => {
  it("every CATEGORY_ART photo exists in the lab public dir", () => {
    for (const [handle, art] of Object.entries(CATEGORY_ART)) {
      const file = join(DIR, art.photo.replace("/images/categories/", ""))
      expect(
        (() => {
          try {
            return statSync(file).isFile()
          } catch {
            return false
          }
        })(),
        `${handle} -> ${art.photo} must exist for mirroring`,
      ).toBe(true)
    }
  })

  it("no orphan, source, pre-crop, or non-webp files in the mirror dir", () => {
    const referenced = new Set(
      Object.values(CATEGORY_ART).map((a) => a.photo.replace("/images/categories/", "")),
    )
    const files = readdirSync(DIR).filter((f) => f !== "MANIFEST.md")
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      expect(f.endsWith(".pre-crop"), `${f} backup must never ship in the lab`).toBe(false)
      expect(f.includes("-source."), `${f} master must never ship in the lab`).toBe(false)
      expect(f.endsWith(".webp"), `${f} must be webp`).toBe(true)
      expect(referenced.has(f), `${f} is orphaned — reference it or remove it`).toBe(true)
    }
  })

  it("every webp stays inside the mobile budget", () => {
    for (const f of readdirSync(DIR).filter((f) => f.endsWith(".webp"))) {
      const size = statSync(join(DIR, f)).size
      expect(size, `${f} is ${size} bytes, budget is ${BUDGET}`).toBeLessThan(BUDGET)
    }
  })
})
