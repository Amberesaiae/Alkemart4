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
        description="Review proposed listings. Confirm to publish, request changes so the seller can fix, or reject with a clear reason."
        meta={
          <button type="button" className="alk-btn alk-btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? <AlkEmpty>Loading proposed products…</AlkEmpty> : null}
      {error ? <AlkError>{error}</AlkError> : null}
      {flash ? (
        <div className="alk-banner">
          <strong>{flash}</strong>
        </div>
      ) : null}

      <div className="alk-panel">
        <h3 className="alk-section-title">Message for reject / request changes</h3>
        <div className="alk-form-grid">
          <label className="alk-field">
            <span className="alk-field-label">Reason code</span>
            <select
              className="alk-select"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
            >
              {codes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="alk-field">
            <span className="alk-field-label">Notes (optional)</span>
            <input
              className="alk-input"
              type="text"
              placeholder="Optional notes for the seller"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
          </label>
        </div>
      </div>

      {!loading && items.length === 0 ? (
        <AlkEmpty>No products awaiting review.</AlkEmpty>
      ) : (
        <div className="alk-stack">
          {items.map((p) => (
            <div key={p.id} className="alk-panel">
              <div className="alk-media-row">
                {p.thumbnail ? (
                  <img
                    className="alk-thumb"
                    src={p.thumbnail}
                    alt=""
                    width={64}
                    height={64}
                  />
                ) : (
                  <div className="alk-thumb alk-thumb-empty" aria-hidden />
                )}
                <div>
                  <strong className="alk-card-title">{p.title || p.id}</strong>
                  <p className="alk-muted">
                    {p.seller?.name || p.seller?.handle || "Unknown seller"}
                    {p.quality
                      ? ` · quality ${p.quality.score} (${p.quality.band})`
                      : ""}
                  </p>
                  {p.quality?.blocking?.length ? (
                    <p className="alk-status is-error">
                      {p.quality.blocking.join(" · ")}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="alk-panel-footer">
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
