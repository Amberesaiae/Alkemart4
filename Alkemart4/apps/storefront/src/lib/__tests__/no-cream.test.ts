/**
 * Guard: gold is a CTA/accent colour, never a surface.
 *
 * The palette moved from cream paper to premium white, but the page still
 * looked cream — because ~31 surfaces were painted with `bg-primary/N`.
 * Gold at 99% saturation washed over white mixes straight back to cream
 * (`bg-primary/5` over #fafaf9 lands on #faf7ef — essentially the old
 * #fbf7ee it replaced). Changing the background token cannot fix that;
 * the washes have to go.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const SRC = resolve(__dirname, "../..")
const CSS = resolve(SRC, "styles/index.css")

function grep(pattern: string): string[] {
  try {
    return execFileSync(
      "grep",
      ["-rn", "-E", pattern, SRC, "--include=*.tsx"],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean)
  } catch {
    return [] // grep exits 1 when there are no matches
  }
}

function mixOnWhite(hex: string, alpha: number): number {
  const page = [0xfa, 0xfa, 0xf9]
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const out = c.map((v, i) => page[i] * (1 - alpha) + v * alpha)
  return Math.max(...out) - Math.min(...out) // channel spread == warmth
}

describe("gold never becomes a surface", () => {
  it("demonstrates why: a faint gold wash still computes to cream", () => {
    // 8+ points of channel spread is a visible warm cast.
    expect(mixOnWhite("#febf31", 0.05)).toBeGreaterThan(8)
    expect(mixOnWhite("#febf31", 0.1)).toBeGreaterThan(8)
  })

  it("has no bg-primary/N washes in components", () => {
    expect(grep("bg-primary/[0-9]")).toEqual([])
  })

  it("has no raw amber/yellow/orange surfaces", () => {
    expect(grep("bg-(amber|yellow|orange)-[0-9]")).toEqual([])
  })

  it("keeps large CSS gradients off the brand hue", () => {
    const css = readFileSync(CSS, "utf8")
    const heroGround = css.slice(
      css.indexOf(".listing-hero-ground"),
      css.indexOf("}", css.indexOf(".listing-hero-ground")),
    )
    expect(heroGround).not.toMatch(/var\(--primary\)/)
  })
})
