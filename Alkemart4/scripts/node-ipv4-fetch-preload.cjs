/**
 * Force undici/Node fetch to IPv4 only.
 * Some networks return ENETUNREACH on IPv6 to api.cloudflare.com, and
 * happy-eyeballs then times out — breaking `wrangler pages deploy`.
 *
 * Usage:
 *   NODE_OPTIONS="--dns-result-order=ipv4first -r ./scripts/node-ipv4-fetch-preload.cjs" wrangler pages deploy dist --project-name ...
 */
try {
  const { Agent, setGlobalDispatcher } = require("undici")
  setGlobalDispatcher(
    new Agent({
      connect: { family: 4, timeout: 60_000 },
      headersTimeout: 120_000,
      bodyTimeout: 300_000,
    }),
  )
} catch (err) {
  console.warn("[ipv4-preload] undici unavailable:", err && err.message)
}
