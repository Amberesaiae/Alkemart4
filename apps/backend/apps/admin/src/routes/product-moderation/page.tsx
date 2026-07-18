import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { Package } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import {
  AlkEmpty,
  AlkError,
  AlkPage,
  AlkPageHeader,
} from "../../components/ui"

declare const __BACKEND_URL__: string

export const config: RouteConfig = {
  label: "Product review",
  icon: Package,
  rank: 4,
}

type ReasonCode = { code: string; label: string; defaultText: string }

type ProductRow = {
  id: string
  title?: string
  handle?: string
  thumbnail?: string | null
  seller?: { id?: string; name?: string; handle?: string } | null
  quality?: { score: number; band: string; blocking: string[] }
}

function baseUrl() {
  return (
    typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__
      ? __BACKEND_URL__
      : "http://localhost:9000"
  ).replace(/\/$/, "")
}

function composeMessage(code: string, text: string, codes: ReasonCode[]) {
  const entry = codes.find((c) => c.code === code)
  const body = text.trim() || entry?.defaultText || "See notes"
  return `[${code}] ${body}`
}

export default function ProductModerationPage() {
  const base = baseUrl()
  const [items, setItems] = useState<ProductRow[]>([])
  const [codes, setCodes] = useState<ReasonCode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [reasonCode, setReasonCode] = useState("poor_images")
  const [reasonText, setReasonText] = useState("")
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${base}/admin/alkemart/moderation/products`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Sign in required"
            : `Could not load products (${res.status})`,
        )
      }
      const json = (await res.json()) as {
        proposed: ProductRow[]
        reason_codes: ReasonCode[]
      }
      setItems(json.proposed || [])
      setCodes(json.reason_codes || [])
      if (json.reason_codes?.[0]) setReasonCode(json.reason_codes[0].code)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [base])

  useEffect(() => {
    void load()
  }, [load])

  async function postAction(
    id: string,
    path: "confirm" | "reject" | "request-changes",
  ) {
    setBusy(id)
    setFlash(null)
    setError(null)
    try {
      const body =
        path === "confirm"
          ? {}
          : { message: composeMessage(reasonCode, reasonText, codes) }
      const res = await fetch(`${base}/admin/products/${id}/${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`${path} failed (${res.status})`)
      setFlash(
        path === "confirm"
          ? "Product published"
          : path === "reject"
            ? "Product rejected"
            : "Changes requested",
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <AlkPage>
      <AlkPageHeader
        badge="alkemart · ops"
        title="Product review"
        description="Proposed listings from sellers. Confirm publishes; reject sets status rejected (Mercur); request-changes keeps proposed."
        meta={
          <button type="button" className="alk-btn alk-btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? <AlkEmpty>Loading proposed products…</AlkEmpty> : null}
      {error ? <AlkError>{error}</AlkError> : null}
      {flash ? (
        <div className="alk-banner" style={{ marginBottom: 12 }}>
          <strong>{flash}</strong>
        </div>
      ) : null}

      <div className="alk-kpi" style={{ textAlign: "left", marginBottom: 16 }}>
        <div className="alk-kpi-label">
          Message for reject / request changes
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            style={{ minWidth: 160, padding: 8 }}
          >
            {codes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Optional notes"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: 8 }}
          />
        </div>
      </div>

      {!loading && items.length === 0 ? (
        <AlkEmpty>No products awaiting review.</AlkEmpty>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((p) => (
            <div key={p.id} className="alk-kpi" style={{ textAlign: "left" }}>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                {p.thumbnail ? (
                  <img
                    src={p.thumbnail}
                    alt=""
                    width={64}
                    height={64}
                    style={{
                      objectFit: "cover",
                      borderRadius: 8,
                      background: "#f3f4f6",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 8,
                      background: "#f3f4f6",
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: "1.05rem" }}>
                    {p.title || p.id}
                  </strong>
                  <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                    {p.seller?.name || p.seller?.handle || "Unknown seller"}
                    {p.quality
                      ? ` · quality ${p.quality.score} (${p.quality.band})`
                      : ""}
                  </div>
                  {p.quality?.blocking?.length ? (
                    <div style={{ fontSize: 12, color: "#9a3412", marginTop: 4 }}>
                      {p.quality.blocking.join(" · ")}
                    </div>
                  ) : null}
                </div>
              </div>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}
              >
                <button
                  type="button"
                  className="alk-btn"
                  disabled={busy === p.id}
                  onClick={() => void postAction(p.id, "confirm")}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="alk-btn alk-btn-secondary"
                  disabled={busy === p.id}
                  onClick={() => void postAction(p.id, "request-changes")}
                >
                  Request changes
                </button>
                <button
                  type="button"
                  className="alk-btn alk-btn-secondary"
                  disabled={busy === p.id}
                  onClick={() => void postAction(p.id, "reject")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AlkPage>
  )
}
