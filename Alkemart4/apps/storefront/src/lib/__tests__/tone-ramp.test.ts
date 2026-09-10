/**
 * Contrast guard for the shared badge tone ramp.
 *
 * The ramp is generated, but it lives as plain hex in three stylesheets and
 * is trivially hand-editable. These tests re-derive the contrast from the
 * committed CSS so a "just nudge the green" edit fails here rather than
 * shipping an unreadable badge.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const APPS = {
  storefront: "src/styles/index.css",
  admin: "../backend/apps/admin/src/styles/index.css",
  vendor: "../backend/apps/ghana-vendor/src/styles/index.css",
} as const

const TONES = [
  "neutral",
  "brand",
  "success",
  "warning",
  "danger",
  "info",
  "scarce",
] as const

const CARD = "#ffffff"
const AA = 4.5

function css(app: keyof typeof APPS): string {
  return readFileSync(resolve(__dirname, "../../..", APPS[app]), "utf8")
}

function token(source: string, name: string): string {
  const m = source.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
  if (!m) throw new Error(`token --${name} not found`)
  return m[1]
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = c.map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe("badge tone ramp", () => {
  it("sanity-checks the contrast helper against known pairs", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1)
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5)
  })

  for (const app of Object.keys(APPS) as (keyof typeof APPS)[]) {
    describe(app, () => {
      const source = css(app)

      it.each(TONES)("%s solid holds its text colour", (tone) => {
        expect(
          contrast(token(source, `tone-${tone}`), token(source, `tone-${tone}-fg`)),
        ).toBeGreaterThanOrEqual(AA)
      })

      it.each(TONES)("%s ink is readable on its soft tint", (tone) => {
        expect(
          contrast(
            token(source, `tone-${tone}-ink`),
            token(source, `tone-${tone}-soft`),
          ),
        ).toBeGreaterThanOrEqual(AA)
      })

      it.each(TONES)("%s ink is readable on a white card", (tone) => {
        expect(
          contrast(token(source, `tone-${tone}-ink`), CARD),
        ).toBeGreaterThanOrEqual(AA)
      })

      it("keeps soft tints opaque — alpha chips vanish over photography", () => {
        for (const tone of TONES) {
          expect(token(source, `tone-${tone}-soft`)).toMatch(/^#[0-9a-f]{6}$/i)
        }
      })

      it("scans the shared UI package for Tailwind classes", () => {
        // Without this @source, every utility used only inside packages/ui
        // is silently never generated and badges render unstyled.
        expect(source).toMatch(/@source\s+"[^"]*packages\/ui\/src"/)
      })
    })
  }

  it("keeps the three apps on an identical ramp", () => {
    const sources = (Object.keys(APPS) as (keyof typeof APPS)[]).map(css)
    for (const tone of TONES) {
      for (const suffix of ["", "-fg", "-soft", "-ink"]) {
        const values = sources.map((s) => token(s, `tone-${tone}${suffix}`))
        expect(new Set(values).size).toBe(1)
      }
    }
  })
})
