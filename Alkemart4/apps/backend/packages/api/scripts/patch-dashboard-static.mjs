#!/usr/bin/env node
/**
 * Mercur DashboardBase uses bare express.static(buildDir) → max-age=0, no compression.
 * That forces ~7MB JS re-download every load. Patch after install for hashed assets:
 * - long cache (immutable)
 * - fallthrough for SPA still works
 *
 * Compression is enabled in start-with-compression.mjs (wraps HTTP server).
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const root = process.cwd()

function findDashboardBase(startDir) {
  const candidates = []
  const walk = (dir, depth = 0) => {
    if (depth > 8) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === ".git" || e.name === "dist") continue
        walk(p, depth + 1)
      } else if (e.name === "dashboard-base.js" && p.includes("@mercurjs")) {
        candidates.push(p)
      }
    }
  }
  // Prefer node_modules near cwd (artifact root after Docker COPY)
  for (const base of [
    path.join(startDir, "node_modules"),
    path.join(startDir, ".bun"),
    startDir,
  ]) {
    if (fs.existsSync(base)) walk(base)
  }
  return candidates
}

const needle = "express_1.default.static(buildDir)"
const replacement =
  'express_1.default.static(buildDir, { maxAge: "365d", immutable: true, index: false })'

let patched = 0
for (const file of findDashboardBase(root)) {
  let src = fs.readFileSync(file, "utf8")
  if (!src.includes(needle)) {
    if (src.includes("maxAge") && src.includes("immutable")) {
      console.log(`[patch-dashboard-static] already patched: ${file}`)
      continue
    }
    // ESM / alternate compile shape
    const alt = "express.static(buildDir)"
    if (src.includes(alt) && !src.includes("maxAge")) {
      src = src.replaceAll(alt, 'express.static(buildDir, { maxAge: "365d", immutable: true, index: false })')
      fs.writeFileSync(file, src)
      patched++
      console.log(`[patch-dashboard-static] patched (alt): ${file}`)
      continue
    }
    console.warn(`[patch-dashboard-static] pattern not found: ${file}`)
    continue
  }
  src = src.replaceAll(needle, replacement)
  fs.writeFileSync(file, src)
  patched++
  console.log(`[patch-dashboard-static] patched: ${file}`)
}

if (!patched) {
  console.warn(
    "[patch-dashboard-static] no files patched — dashboards may still serve with max-age=0",
  )
} else {
  console.log(`[patch-dashboard-static] done (${patched} file(s))`)
}
