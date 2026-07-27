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
