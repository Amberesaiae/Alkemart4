#!/usr/bin/env node
/**
 * Preload script to disable @cspotcode/source-map-support on Bun.
 * The library crashes Bun with "column must be greater than or equal to 0".
 * Pass via NODE_OPTIONS=--import ./scripts/bun-no-sourcemaps.mjs
 */
import Module from "node:module"

if (typeof Bun !== "undefined") {
  const orig = Module._resolveFilename
  Module._resolveFilename = function (request, parent, ...rest) {
    if (request.includes("source-map-support")) {
      // Return a synthetic module path that exports a no-op
      return "/bun-noop-source-map-support"
    }
    return orig.call(this, request, parent, ...rest)
  }

  // Register the synthetic module
  const origLoad = Module._load
  Module._load = function (request, parent, ...rest) {
    if (request === "/bun-noop-source-map-support") {
      return { install() {} }
    }
    return origLoad.call(this, request, parent, ...rest)
  }
}
