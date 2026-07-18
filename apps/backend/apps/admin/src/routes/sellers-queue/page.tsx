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
      <div className="alk-kpi" style={{ textAlign: "left" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <strong style={{ fontSize: "1.05rem" }}>
            {s.name || s.handle || s.id}
          </strong>
          <span style={{ fontSize: 12, opacity: 0.75 }}>
            {s.status}
            {s.phase ? ` · ${s.phase}` : ""}
          </span>
        </div>
        <div style={{ fontSize: 13, marginTop: 6, opacity: 0.85 }}>
          {s.email || "—"} · @{s.handle || "—"}
        </div>
        {s.status_reason ? (
          <div style={{ fontSize: 12, marginTop: 6, color: "#9a3412" }}>
            {s.status_reason}
          </div>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {showReject ? (
            <>
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
            </>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <AlkPage>
      <AlkPageHeader
        badge="alkemart · ops"
        title="Seller applications"
        description="Approve shops or reject via Mercur suspend with a reason code. Lifecycle stays on Mercur — this is the ops queue."
        meta={
          <button type="button" className="alk-btn alk-btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? <AlkEmpty>Loading seller queue…</AlkEmpty> : null}
      {error ? <AlkError>{error}</AlkError> : null}
      {flash ? (
        <div className="alk-banner" style={{ marginBottom: 12 }}>
          <strong>{flash}</strong>
        </div>
      ) : null}

      <div className="alk-kpi" style={{ textAlign: "left", marginBottom: 16 }}>
        <div className="alk-kpi-label">Reject reason (for “Reject application”)</div>
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

      <h2 style={{ fontSize: "1rem", margin: "16px 0 8px" }}>
        Pending approval ({pending.length})
      </h2>
      {!loading && pending.length === 0 ? (
        <AlkEmpty>No sellers waiting for approval.</AlkEmpty>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {pending.map((s) => (
            <SellerCard key={s.id} s={s} showReject />
          ))}
        </div>
      )}

      <h2 style={{ fontSize: "1rem", margin: "24px 0 8px" }}>
        Rejected applications ({rejected.length})
      </h2>
      {!loading && rejected.length === 0 ? (
        <AlkEmpty>No rejected applications.</AlkEmpty>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rejected.map((s) => (
            <SellerCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </AlkPage>
  )
}
