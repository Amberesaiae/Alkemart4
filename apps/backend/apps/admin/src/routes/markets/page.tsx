import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { Globe } from "lucide-react"
import { useEffect, useState } from "react"
import { AlkEmpty, AlkError, AlkPage, AlkPageHeader } from "../../components/ui"

declare const __BACKEND_URL__: string

export const config: RouteConfig = {
  label: "Markets",
  icon: Globe,
  rank: 2,
}

type Market = {
  region_id: string
  region_name: string
  currency_code: string
  country_code: string
  display_name: string
  locale: {
    phone: { example: string; hint: string }
    address: { fields: { key: string; label: string }[] }
    payments: { preferred: string[] }
  }
}

/**
 * Operating markets spine — what Admin has enabled via Regions.
 * Country selection on buyer/seller forms derives from this list.
 */
export default function MarketsPage() {
  const base = (
    typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__
      ? __BACKEND_URL__
      : "http://localhost:9000"
  ).replace(/\/$/, "")

  const [markets, setMarkets] = useState<Market[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [guidance, setGuidance] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${base}/admin/alkemart/markets`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        })
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? "Sign in required"
              : `Could not load markets (${res.status})`,
          )
        }
        const json = (await res.json()) as {
          markets: Market[]
          guidance?: { how_to_enable_country?: string }
        }
        if (!cancelled) {
          setMarkets(json.markets || [])
          setGuidance(json.guidance?.how_to_enable_country || "")
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [base])

  return (
    <AlkPage>
      <AlkPageHeader
        badge="alkemart · ops"
        title="Operating markets"
        description="Countries currently in operation. Enable or disable under Settings → Regions (currency + country). Forms, currency, and address rules follow this list."
      />

      {loading ? <AlkEmpty>Loading markets…</AlkEmpty> : null}
      {error ? <AlkError>{error}</AlkError> : null}

      {!loading && !error && markets.length === 0 ? (
        <AlkEmpty>
          No countries in operation yet. Add a region with a currency and attach
          a country in Settings → Regions.
        </AlkEmpty>
      ) : null}

      {markets.length > 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          {markets.map((m) => (
            <div
              key={`${m.region_id}-${m.country_code}`}
              className="alk-kpi"
              style={{ textAlign: "left" }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <strong style={{ fontSize: "1.1rem" }}>{m.display_name}</strong>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "#5c5c5c",
                  }}
                >
                  {m.country_code} · {m.currency_code}
                </span>
              </div>
              <p
                style={{ margin: "8px 0 0", fontSize: 13, color: "#5c5c5c" }}
              >
                Region: {m.region_name} · payments:{" "}
                {(m.locale.payments?.preferred || [])
                  .map((p) => p.replace(/_/g, " "))
                  .join(", ") || "—"}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#5c5c5c" }}>
                Address fields:{" "}
                {(m.locale.address?.fields || [])
                  .map((f) => f.label)
                  .join(" · ")}
              </p>
              {m.locale.phone?.hint ? (
                <p style={{ margin: "6px 0 0", fontSize: 12 }}>
                  Phone: {m.locale.phone.example || "—"} — {m.locale.phone.hint}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {guidance ? (
        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "#5c5c5c",
            maxWidth: 560,
            lineHeight: 1.45,
          }}
        >
          {guidance}
        </p>
      ) : null}
    </AlkPage>
  )
}
