import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"
import { useCallback, useEffect, useState } from "react"
import {
  AlkBanner,
  AlkButton,
  AlkField,
  AlkPanel,
  type AlkBannerTone,
} from "../components/ui"

export const config = defineWidgetConfig({
  zone: "seller.setup.before",
})

/** Keep in sync with packages/api/src/lib/ghana-locale.ts GHANA_REGIONS */
const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
] as const

type Readiness = {
  phase: string
  setup_complete: boolean
  next_action?: { code: string; label: string } | null
  checklist?: Record<string, boolean>
  checklist_labels?: Record<string, string>
  quick_setup_available?: boolean
  mercur_status?: string
  poll_after_seconds?: number
}

async function fetchReadiness(): Promise<Readiness | null> {
  try {
    const res = await fetch("/vendor/alkemart/onboarding/status", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    return (await res.json()) as Readiness
  } catch {
    return null
  }
}

function titleFor(phase: string): string {
  switch (phase) {
    case "pending_approval":
      return "Under review"
    case "rejected":
      return "Needs a fix"
    case "setup_incomplete":
      return "Finish Ghana delivery"
    case "active":
      return "Ready to sell"
    case "suspended":
      return "Shop paused"
    case "terminated":
      return "Shop closed"
    default:
      return "Set up your shop"
  }
}

function toneFor(phase: string): AlkBannerTone {
  switch (phase) {
    case "active":
      return "success"
    case "pending_approval":
      return "info"
    case "rejected":
    case "suspended":
    case "terminated":
      return "danger"
    case "setup_incomplete":
      return "warning"
    default:
      return "default"
  }
}

const DEFAULT_LABELS: Record<string, string> = {
  profile: "Shop name & contact",
  address: "Pack address & delivery region",
}

export default function SellerSetupBanner() {
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [setupMsg, setSetupMsg] = useState<string | null>(null)
  const [setupErr, setSetupErr] = useState(false)
  const [form, setForm] = useState({
    pack_from_name: "",
    address_1: "",
    city: "Accra",
    region: "Greater Accra",
    phone: "",
    delivery_fee_ghs: "20",
  })

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      const data = await fetchReadiness()
      if (cancelled) return
      setReadiness(data)
      setLoaded(true)
      const raw =
        data?.poll_after_seconds && data.poll_after_seconds > 0
          ? data.poll_after_seconds
          : data?.phase === "active" || data?.setup_complete
            ? 0
            : 45
      const secs = raw > 0 ? Math.max(45, raw) : 0
      if (secs > 0) {
        timer = setTimeout(tick, secs * 1000)
      }
    }

    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  const runQuickSetup = async () => {
    setBusy(true)
    setSetupMsg(null)
    setSetupErr(false)
    try {
      const res = await fetch("/vendor/alkemart/onboarding/ghana-setup", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pack_from_name: form.pack_from_name || undefined,
          address_1: form.address_1,
          city: form.city,
          region: form.region,
          phone: form.phone || undefined,
          delivery_fee_ghs: Number(form.delivery_fee_ghs) || 20,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        message?: string
        readiness?: Readiness
      }
      if (!res.ok) {
        setSetupErr(true)
        setSetupMsg(data.error || "Setup failed — try again.")
      } else {
        setSetupMsg(data.message || "Saved.")
        if (data.readiness) setReadiness(data.readiness)
        else {
          const next = await fetchReadiness()
          if (next) setReadiness(next)
        }
      }
    } catch {
      setSetupErr(true)
      setSetupMsg("Network error — check connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  const scrollToSetup = useCallback(() => {
    const el = document.getElementById("ghana-quick-setup") || document.querySelector(".alk-onboarding .alk-panel")
    el?.scrollIntoView({ behavior: "smooth" })
  }, [])

  if (!loaded) {
    return (
      <AlkBanner
        title="Loading shop setup…"
        body="Loading readiness…"
        tone="info"
      />
    )
  }

  const phase = readiness?.phase || "setup_incomplete"

  /* Active shops: quiet one-line tip, not a full wizard */
  if (phase === "active") {
    return (
      <AlkBanner
        title={titleFor("active")}
        body="Add products with photos and a GH₵ price."
        tone="success"
        onClick={() => {
          const el = document.querySelector('[class*="product"]') || document.querySelector("main")
          el?.scrollIntoView({ behavior: "smooth" })
        }}
      />
    )
  }

  const body =
    readiness?.next_action?.label ||
    "Set pack address and delivery fee."

  const checklist = readiness?.checklist
  const labels = readiness?.checklist_labels || DEFAULT_LABELS
  const showQuick =
    readiness?.quick_setup_available ||
    readiness?.next_action?.code === "ghana_quick_setup"

  const doneCount = checklist
    ? Object.keys(DEFAULT_LABELS).filter((k) => checklist[k]).length
    : 0
  const totalCount = Object.keys(DEFAULT_LABELS).length

  return (
    <div className="alk-stack alk-onboarding">
      <AlkBanner
        title={titleFor(phase)}
        body={body}
        tone={toneFor(phase)}
        as="section"
        onClick={scrollToSetup}
      />

      {checklist ? (
        <div className="alk-checklist-wrap">
          <div className="alk-progress">
            <span className="alk-progress-label" id="setup-checklist-label">
              Setup: {doneCount}/{totalCount}
            </span>
            <div className="alk-progress-track" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={totalCount} aria-labelledby="setup-checklist-label">
              <div className="alk-progress-fill" style={{ width: `${(doneCount / totalCount) * 100}%` }} />
            </div>
          </div>
          <ul
            className="alk-checklist"
            aria-labelledby="setup-checklist-label"
          >
            {(
              Object.keys(DEFAULT_LABELS) as Array<keyof typeof DEFAULT_LABELS>
            ).map((key) => {
              const ok = Boolean(checklist[key])
              return (
                <li key={key} className={ok ? "is-done" : undefined}>
                  <span className="alk-check-mark" aria-hidden="true">
                    {ok ? "✓" : "○"}
                  </span>
                  <span>
                    {labels[key] || DEFAULT_LABELS[key]}
                    <span className="sr-only">
                      {ok ? " — complete" : " — not done yet"}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {showQuick ? (
        <AlkPanel title="Ghana quick setup" id="ghana-quick-setup">
          <p className="alk-muted">
            One form — pack location and Ghana delivery fee.
          </p>
          <div className="alk-form-grid">
            <AlkField label="Pack-from name (optional)" htmlFor="pack-from">
              <input
                id="pack-from"
                className="alk-input"
                autoComplete="organization"
                placeholder="e.g. My shop — Madina"
                value={form.pack_from_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pack_from_name: e.target.value }))
                }
              />
            </AlkField>
            <AlkField label="Mobile (optional)" htmlFor="setup-phone">
              <input
                id="setup-phone"
                className="alk-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="024…"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </AlkField>
            <AlkField label="Area / street / landmark *" htmlFor="setup-address">
              <input
                id="setup-address"
                className="alk-input"
                autoComplete="street-address"
                placeholder="Near Goil, blue gate…"
                value={form.address_1}
                required
                aria-required="true"
                onChange={(e) =>
                  setForm((f) => ({ ...f, address_1: e.target.value }))
                }
              />
            </AlkField>
            <AlkField label="City / town *" htmlFor="setup-city">
              <input
                id="setup-city"
                className="alk-input"
                autoComplete="address-level2"
                value={form.city}
                required
                aria-required="true"
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
              />
            </AlkField>
            <AlkField label="Region" htmlFor="setup-region">
              <select
                id="setup-region"
                className="alk-select"
                value={form.region}
                onChange={(e) =>
                  setForm((f) => ({ ...f, region: e.target.value }))
                }
              >
                {GHANA_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </AlkField>
            <AlkField label="Delivery fee (GH₵)" htmlFor="setup-fee">
              <input
                id="setup-fee"
                className="alk-input"
                inputMode="decimal"
                value={form.delivery_fee_ghs}
                onChange={(e) =>
                  setForm((f) => ({ ...f, delivery_fee_ghs: e.target.value }))
                }
              />
            </AlkField>
          </div>
          <div className="alk-panel-footer">
            <AlkButton
              disabled={busy || !form.address_1.trim() || !form.city.trim()}
              aria-busy={busy}
              onClick={() => void runQuickSetup()}
            >
              {busy ? "Setting up…" : "Set up Ghana delivery"}
            </AlkButton>
            {setupMsg ? (
              <span
                className={`alk-status ${setupErr ? "is-error" : "is-ok"}`}
                role={setupErr ? "alert" : "status"}
                aria-live="polite"
              >
                {setupMsg}
              </span>
            ) : null}
          </div>
        </AlkPanel>
      ) : null}
    </div>
  )
}
