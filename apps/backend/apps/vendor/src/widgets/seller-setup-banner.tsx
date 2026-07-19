import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"
import { useEffect, useState } from "react"
import {
  AlkBanner,
  AlkButton,
  AlkField,
  AlkPanel,
} from "../components/ui"

export const config = defineWidgetConfig({
  zone: "seller.setup.before",
})

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
      return "We're checking your shop"
    case "rejected":
      return "Application needs a small fix"
    case "setup_incomplete":
      return "Almost ready — Ghana delivery"
    case "active":
      return "You're ready to sell in Ghana"
    case "suspended":
      return "Shop paused"
    case "terminated":
      return "Shop closed"
    default:
      return "Set up your Ghana shop"
  }
}

const DEFAULT_LABELS: Record<string, string> = {
  profile: "Shop name and Ghana contact details",
  stock_location: "Where you pack orders (shop or house)",
  sales_channel_link: "Shop linked so buyers can see your stock",
  shipping_profile: "How you send goods (courier / delivery)",
  gh_shipping_option: "Delivery price for Ghana",
}

export default function SellerSetupBanner() {
  const [readiness, setReadiness] = useState<Readiness | null>(null)
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
      // Never hammer Neon: min 45s between polls; stop when active.
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

  if (readiness?.phase === "active") {
    return (
      <AlkBanner
        title={titleFor("active")}
        body="Add products with clear photos and a GH₵ price. Buyers pay cash on delivery or MoMo when enabled."
      />
    )
  }

  const body =
    readiness?.next_action?.label ||
    "Tell us where you pack orders and your delivery fee. No warehouse software needed."

  const checklist = readiness?.checklist
  const labels = readiness?.checklist_labels || DEFAULT_LABELS
  const showQuick =
    readiness?.quick_setup_available ||
    readiness?.next_action?.code === "ghana_quick_setup"

  return (
    <div className="alk-stack">
      <AlkBanner
        title={titleFor(readiness?.phase || "setup_incomplete")}
        body={body}
      />

      {checklist ? (
        <ul className="alk-checklist">
          {(Object.keys(DEFAULT_LABELS) as Array<keyof typeof DEFAULT_LABELS>).map(
            (key) => {
              const ok = Boolean(checklist[key])
              return (
                <li key={key} className={ok ? "is-done" : undefined}>
                  <span className="alk-check-mark" aria-hidden>
                    {ok ? "✓" : "○"}
                  </span>
                  <span>{labels[key] || DEFAULT_LABELS[key]}</span>
                </li>
              )
            },
          )}
        </ul>
      ) : null}

      {showQuick ? (
        <AlkPanel title="Ghana quick setup">
          <p className="alk-muted">
            One form — we set pack location and Ghana delivery for you. Fill what
            a rider needs.
          </p>
          <div className="alk-form-grid">
            <AlkField label="Pack-from name (optional)">
              <input
                className="alk-input"
                placeholder="e.g. My shop — Madina"
                value={form.pack_from_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pack_from_name: e.target.value }))
                }
              />
            </AlkField>
            <AlkField label="Phone (optional)">
              <input
                className="alk-input"
                placeholder="024…"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </AlkField>
            <AlkField label="Area / street / landmark *">
              <input
                className="alk-input"
                placeholder="Near Goil, blue gate…"
                value={form.address_1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address_1: e.target.value }))
                }
              />
            </AlkField>
            <AlkField label="City / town *">
              <input
                className="alk-input"
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
              />
            </AlkField>
            <AlkField label="Region">
              <input
                className="alk-input"
                value={form.region}
                onChange={(e) =>
                  setForm((f) => ({ ...f, region: e.target.value }))
                }
              />
            </AlkField>
            <AlkField label="Delivery fee (GH₵)">
              <input
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
              onClick={() => void runQuickSetup()}
            >
              {busy ? "Setting up…" : "Set up Ghana delivery"}
            </AlkButton>
            {setupMsg ? (
              <span
                className={`alk-status ${setupErr ? "is-error" : "is-ok"}`}
                role="status"
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
