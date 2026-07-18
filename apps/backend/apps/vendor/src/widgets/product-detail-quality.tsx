import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"
import { useEffect, useState } from "react"
import { AlkBanner } from "../components/ui"

/**
 * Best-effort product detail quality panel.
 * Zone may not exist on all Mercur versions — widget is ignored if zone missing.
 */
export const config = defineWidgetConfig({
  zone: "product.details.after",
})

type QualityPayload = {
  quality?: {
    score: number
    band: string
    blocking: string[]
  }
  propose_ok?: boolean
  media?: { derivatives_status?: string } | null
  status?: string
}

function productIdFromPath(): string | null {
  try {
    const m = window.location.pathname.match(/products\/([^/]+)/)
    return m?.[1] && m[1] !== "create" ? m[1] : null
  } catch {
    return null
  }
}

export default function ProductDetailQuality() {
  const [data, setData] = useState<QualityPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = productIdFromPath()

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/vendor/alkemart/products/${id}/quality`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        })
        if (!res.ok) {
          if (!cancelled) setError(`Quality unavailable (${res.status})`)
          return
        }
        const json = (await res.json()) as QualityPayload
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setError("Could not load quality score")
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) return null
  if (error) {
    return (
      <AlkBanner
        title="Listing quality"
        body="Open this product after saving to see score and propose readiness."
      />
    )
  }
  if (!data?.quality) {
    return (
      <AlkBanner title="Listing quality" body="Loading quality score…" />
    )
  }

  const q = data.quality
  const media = data.media?.derivatives_status
    ? ` Images: ${data.media.derivatives_status}.`
    : ""
  const block =
    q.blocking?.length > 0
      ? ` Fix: ${q.blocking.join("; ")}.`
      : " Ready to propose (if shop setup is complete)."

  const canPropose =
    data.propose_ok &&
    data.status &&
    ["draft", "proposed"].includes(String(data.status).toLowerCase())

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <AlkBanner
        title={`Quality ${q.score}/100 (${q.band})`}
        body={`Status: ${data.status || "—"}.${media}${block}`}
      />
      {canPropose && data.status?.toLowerCase() !== "proposed" ? (
        <button
          type="button"
          className="alk-btn"
          style={{
            justifySelf: "start",
            padding: "0.5rem 0.9rem",
            borderRadius: 8,
            border: "1px solid transparent",
            background: "var(--alkemart-yellow, #f5c518)",
            fontWeight: 600,
            cursor: "pointer",
          }}
          onClick={() => {
            void (async () => {
              const res = await fetch(
                `/vendor/alkemart/products/${id}/propose`,
                {
                  method: "POST",
                  credentials: "include",
                  headers: { Accept: "application/json" },
                },
              )
              if (res.ok) {
                window.location.reload()
                return
              }
              const body = (await res.json().catch(() => ({}))) as {
                error?: string
              }
              window.alert(body.error || `Propose failed (${res.status})`)
            })()
          }}
        >
          Submit for review
        </button>
      ) : null}
    </div>
  )
}
