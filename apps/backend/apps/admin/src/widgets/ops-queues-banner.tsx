import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"
import { useEffect, useState } from "react"
import { AlkBanner } from "../components/ui"
import { panelHref } from "../lib/panel-href"

declare const __BACKEND_URL__: string

export const config = defineWidgetConfig({
  zone: "orders.list.before",
})

type Summary = {
  pending_sellers?: number
  proposed_products?: number
}

function baseUrl() {
  return (
    typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__
      ? __BACKEND_URL__
      : ""
  ).replace(/\/$/, "")
}

/**
 * Ops entry: queue counts + links to Seller queue / Product review.
 */
export default function OpsQueuesBanner() {
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const base = baseUrl()
        const res = await fetch(`${base}/admin/alkemart/moderation/summary`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        })
        if (!res.ok) return
        const json = (await res.json()) as Summary
        if (!cancelled) setSummary(json)
      } catch {
        /* ignore */
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const pending = summary?.pending_sellers ?? 0
  const proposed = summary?.proposed_products ?? 0
  const body =
    summary == null
      ? "Review seller applications and product proposals in the ops queues."
      : `${pending} seller application(s) · ${proposed} product(s) awaiting review`

  return (
    <AlkBanner
      title="Marketplace review queues"
      body={body}
      action={
        <span style={{ display: "inline-flex", gap: 12, flexWrap: "wrap" }}>
          <a href={panelHref("sellers-queue")}>Seller queue →</a>
          <a href={panelHref("product-moderation")}>Product review →</a>
        </span>
      }
    />
  )
}
