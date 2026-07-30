/**
 * Force Node DNS lookups to IPv4.
 *
 * On some WSL/networks Neon resolves to IPv6 first and TCP hangs (ETIMEDOUT),
 * while IPv4 works. Import this first in medusa-config before any DB clients load.
 */
import dns from "node:dns"

try {
  dns.setDefaultResultOrder("ipv4first")
} catch {
  /* older node */
}

process.on("unhandledRejection", (reason) => {
  console.error(JSON.stringify({
    level: "error",
    message: "UNHANDLED_REJECTION",
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    timestamp: new Date().toISOString(),
  }))
})

process.on("uncaughtException", (error) => {
  console.error(JSON.stringify({
    level: "error",
    message: "UNCAUGHT_EXCEPTION",
    reason: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  }))
})
