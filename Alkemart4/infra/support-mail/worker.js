// Cloudflare Email Routing allows one destination per rule, so support@
// hands mail to this Worker, which forwards a copy to every admin inbox.
// Each destination must be a verified Email Routing address.
export default {
  async email(message, env) {
    const destinations = env.DESTINATIONS.split(",").map((d) => d.trim()).filter(Boolean)
    const results = await Promise.allSettled(destinations.map((to) => message.forward(to)))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) console.warn(JSON.stringify({ event: "support-mail-forward", failed, total: destinations.length }))
    // Bounce only when nobody received it, so the sender knows to retry.
    if (failed === destinations.length) message.setReject("Mailbox temporarily unavailable")
  },
}
