/**
 * Force Node DNS lookups to IPv4.
 *
 * On some WSL/networks Neon resolves to IPv6 first and TCP hangs (ETIMEDOUT),
 * while IPv4 works. Import this first in medusa-config before any DB clients load.
 */
import dns from "node:dns"

const orig = dns.lookup.bind(dns)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lookupIpv4(hostname: string, options: any, callback?: any): any {
  if (typeof options === "function") {
    return orig(hostname, { family: 4 }, options)
  }
  if (typeof options === "number") {
    return orig(hostname, { family: 4 }, callback)
  }
  const opts = { ...(options || {}), family: 4 }
  return orig(hostname, opts, callback)
}

// @ts-expect-error override signature variants of dns.lookup
dns.lookup = lookupIpv4

try {
  dns.setDefaultResultOrder("ipv4first")
} catch {
  /* older node */
}
