import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { Store } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import {
  AlkEmpty,
  AlkError,
  AlkPage,
  AlkPageHeader,
} from "../../components/ui"

declare const __BACKEND_URL__: string

export const config: RouteConfig = {
  label: "Seller queue",
  icon: Store,
  rank: 3,
}

type ReasonCode = { code: string; label: string; defaultText: string }

type SellerRow = {
  id: string
  name?: string
  handle?: string
  email?: string
  status?: string
  status_reason?: string | null
  phase?: string | null
  setup_complete?: boolean
  created_at?: string
}

function baseUrl() {
  return (
    typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__
      ? __BACKEND_URL__
      : "http://localhost:9000"
  ).replace(/\/$/, "")
}

function composeReason(code: string, text: string, codes: ReasonCode[]) {
  const entry = codes.find((c) => c.code === code)
  const body = text.trim() || entry?.defaultText || "See notes"
  return `[${code}] ${body}`
}

export default function SellersQueuePage() {
  const base = baseUrl()
  const [pending, setPending] = useState<SellerRow[]>([])
  const [rejected, setRejected] = useState<SellerRow[]>([])
  const [codes, setCodes] = useState<ReasonCode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [reasonCode, setReasonCode] = useState("policy")
  const [reasonText, setReasonText] = useState("")
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${base}/admin/alkemart/moderation/sellers`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Sign in required"
            : `Could not load queue (${res.status})`,
        )
      }
      const json = (await res.json()) as {
        pending: SellerRow[]
        rejected_applications: SellerRow[]
        reason_codes: ReasonCode[]
      }
      setPending(json.pending || [])
      setRejected(json.rejected_applications || [])
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

  async function approve(id: string) {
    setBusy(id)
    setFlash(null)
    try {
      const res = await fetch(`${base}/admin/sellers/${id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: "{}",
      })
      if (!res.ok) throw new Error(`Approve failed (${res.status})`)
      setFlash("Seller approved")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed")
    } finally {
      setBusy(null)
    }
  }

  async function reject(id: string) {
    setBusy(id)
    setFlash(null)
    try {
      const reason = composeReason(reasonCode, reasonText, codes)
      const res = await fetch(`${base}/admin/sellers/${id}/suspend`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error(`Reject failed (${res.status})`)
      setFlash("Application rejected (suspended)")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed")
    } finally {
      setBusy(null)
    }
  }

  function SellerCard({ s, showReject }: { s: SellerRow; showReject?: boolean }) {
    return (
      <div className="alk-panel">
        <div className="alk-row-between">
          <strong className="alk-card-title">
            {s.name || s.handle || s.id}
          </strong>
          <span className="alk-muted">
            {s.status}
            {s.phase ? ` · ${s.phase}` : ""}
          </span>
        </div>
        <p className="alk-muted">
          {s.email || "—"} · @{s.handle || "—"}
        </p>
        {s.status_reason ? (
          <p className="alk-status is-error">{s.status_reason}</p>
        ) : null}
        {showReject ? (
          <div className="alk-panel-footer">
            <button
              type="button"
              className="alk-btn"
              disabled={busy === s.id}
              onClick={() => void approve(s.id)}
            >
              Approve
            </button>
            <button
              type="button"
              className="alk-btn alk-btn-secondary"
              disabled={busy === s.id}
              onClick={() => void reject(s.id)}
            >
              Reject application
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <AlkPage>
      <AlkPageHeader
        badge="alkemart · ops"
        title="Seller applications"
        description="Review new seller applications. Approve to open the shop, or reject with a clear reason the seller can act on."
        meta={
          <button type="button" className="alk-btn alk-btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? <AlkEmpty>Loading seller queue…</AlkEmpty> : null}
      {error ? <AlkError>{error}</AlkError> : null}
      {flash ? (
        <div className="alk-banner">
          <strong>{flash}</strong>
        </div>
      ) : null}

      <div className="alk-panel">
        <h3 className="alk-section-title">Reject reason</h3>
        <p className="alk-muted">Used when you reject an application.</p>
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

      <h2 className="alk-section-title">
        Pending approval ({pending.length})
      </h2>
      {!loading && pending.length === 0 ? (
        <AlkEmpty>No sellers waiting for approval.</AlkEmpty>
      ) : (
        <div className="alk-stack">
          {pending.map((s) => (
            <SellerCard key={s.id} s={s} showReject />
          ))}
        </div>
      )}

      <h2 className="alk-section-title">
        Rejected applications ({rejected.length})
      </h2>
      {!loading && rejected.length === 0 ? (
        <AlkEmpty>No rejected applications.</AlkEmpty>
      ) : (
        <div className="alk-stack">
          {rejected.map((s) => (
            <SellerCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </AlkPage>
  )
}
