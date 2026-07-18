import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"
import { useEffect, useState } from "react"
import { AlkBanner } from "../components/ui"

export const config = defineWidgetConfig({
  zone: "seller.setup.before",
})

type Readiness = {
  phase: string
  setup_complete: boolean
  next_action?: { code: string; label: string } | null
  checklist?: Record<string, boolean>
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
      return "Waiting for shop approval"
    case "rejected":
      return "Application needs changes"
    case "setup_incomplete":
      return "Finish setup to sell in Ghana"
    case "active":
      return "You're ready to sell"
    case "suspended":
      return "Shop suspended"
    case "terminated":
      return "Shop closed"
    default:
      return "Almost ready to sell in Ghana"
  }
}

export default function SellerSetupBanner() {
  const [readiness, setReadiness] = useState<Readiness | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      const data = await fetchReadiness()
      if (cancelled) return
      setReadiness(data)
      const secs =
        data?.poll_after_seconds && data.poll_after_seconds > 0
          ? data.poll_after_seconds
          : data?.phase === "active"
            ? 0
            : 20
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

  if (readiness?.phase === "active") {
    return (
      <AlkBanner
        title={titleFor("active")}
        body="List products with GHS offers. Buyers pay with cash on delivery or MoMo when enabled."
      />
    )
  }

  const body =
    readiness?.next_action?.label ||
    "Finish setup with GHS pricing and a Ghana address, then list offers for cash on delivery or MoMo."

  return (
    <AlkBanner
      title={titleFor(readiness?.phase || "setup_incomplete")}
      body={body}
    />
  )
}
