#!/usr/bin/env node
/**
 * Start Medusa with HTTP compression for dashboard static assets.
 * Mercur panels ship ~7MB JS; without gzip the seller/admin UIs feel broken on mobile.
 */
import compression from "compression"
import { createRequire } from "node:module"
import { spawn } from "node:child_process"
import http from "node:http"
import https from "node:https"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Patch @cspotcode/source-map-support to be a no-op on Bun.
// Bun's source maps conflict with this library and crash MikroORM entity decoration.
if (typeof Bun !== "undefined") {
  const NOOP = "module.exports = { install() {} }\n"
  const patched = new Set()
  const patch = (filePath) => {
    try {
      if (!patched.has(filePath)) {
        fs.writeFileSync(filePath, NOOP)
        patched.add(filePath)
      }
    } catch {}
  }
  // Find all copies: regular node_modules + Bun's .bun cache
  try {
    const modPath = require.resolve("@cspotcode/source-map-support")
    patch(modPath)
    // Also patch the canonical package location
    patch(path.join(path.dirname(modPath), "source-map-support.js"))
  } catch {}
  // Brute-force: patch every .bun copy
  for (const root of [process.cwd(), path.resolve(process.cwd(), "../..")]) {
    try {
      const bunDir = path.join(root, "node_modules/.bun")
      for (const entry of fs.readdirSync(bunDir)) {
        if (entry.includes("source-map-support")) {
          const base = path.join(bunDir, entry, "node_modules/@cspotcode/source-map-support")
          patch(path.join(base, "index.js"))
          patch(path.join(base, "source-map-support.js"))
        }
      }
    } catch {}
  }
  // Also patch the hoisted node_modules copy
  try {
    const hoisted = path.join(process.cwd(), "node_modules/@cspotcode/source-map-support")
    patch(path.join(hoisted, "index.js"))
    patch(path.join(hoisted, "source-map-support.js"))
  } catch {}
  if (patched.size) console.log(`[start] patched ${patched.size} source-map-support files for Bun`)
}

// Patch http.Server to inject compression middleware once per request pipeline.
// We wrap emit('request') so it works regardless of how Medusa attaches listeners.
function installCompression() {
  const compress = compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false
      return compression.filter(req, res)
    },
  })

  const wrap = (Server) => {
    const originalEmit = Server.prototype.emit
    Server.prototype.emit = function (event, ...args) {
      if (event === "request") {
        const [req, res] = args
        return compress(req, res, () => originalEmit.apply(this, [event, ...args]))
      }
      return originalEmit.apply(this, [event, ...args])
    }
  }

  wrap(http.Server)
  wrap(https.Server)
  console.log("[start] HTTP compression enabled for Medusa")
}

installCompression()

// Run medusa start in-process via CLI if available, else child
const medusaBin = require.resolve("@medusajs/cli/cli.js")
const child = spawn(process.execPath, [medusaBin, "start"], {
  stdio: "inherit",
  env: process.env,
})
child.on("exit", (code) => process.exit(code ?? 1))
