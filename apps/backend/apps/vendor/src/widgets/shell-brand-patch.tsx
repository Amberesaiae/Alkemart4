import { useEffect } from "react"
import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

export const config = defineWidgetConfig({
  zone: "orders.list.before",
  id: "alkemart-shell-brand-patch",
})

export default function ShellBrandPatch() {
  useEffect(() => {
    const run = () => {
      document.querySelectorAll("aside *, nav *").forEach((el) => {
        if (!(el instanceof HTMLElement)) return
        if (el.children.length > 0 && el.childElementCount > 2) return
        const t = (el.textContent || "").trim()
        if (!t || t.length > 40) return
        if (/^Medusa Store$/i.test(t) || /^Mercur$/i.test(t)) {
          el.textContent = "alkemart"
          el.style.fontWeight = "800"
        }
      })
      document.querySelectorAll("aside span").forEach((el) => {
        if (!(el instanceof HTMLElement)) return
        if (el.textContent?.trim() === "M" && el.children.length === 0) {
          el.textContent = "a"
          el.style.color = "#f5c518"
          el.style.fontWeight = "800"
        }
      })
      // Hide leftover top-left M chips on login already handled by brand widgets
    }
    run()
    const mo = new MutationObserver(() => run())
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    return () => mo.disconnect()
  }, [])

  return null
}
