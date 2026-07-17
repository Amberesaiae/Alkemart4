import { useEffect } from "react"
import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

/**
 * Injected on orders list (always-on after login).
 * Patches residual shell labels that CSS cannot fully target.
 */
export const config = defineWidgetConfig({
  zone: "orders.list.before",
  id: "alkemart-shell-brand-patch",
})

const BAD = /medusa|mercur/i

export default function ShellBrandPatch() {
  useEffect(() => {
    const run = () => {
      // Sidebar store / product name
      document.querySelectorAll("aside *, nav *").forEach((el) => {
        if (!(el instanceof HTMLElement)) return
        if (el.children.length > 0 && el.childElementCount > 2) return
        const t = (el.textContent || "").trim()
        if (!t || t.length > 40) return
        if (/^Medusa Store$/i.test(t)) {
          el.textContent = "alkemart"
          el.style.fontWeight = "800"
        }
        if (/^Mercur$/i.test(t)) {
          el.textContent = "alkemart"
        }
      })
      // Document title
      if (BAD.test(document.title)) {
        document.title = document.title
          .replace(/medusa/gi, "alkemart")
          .replace(/mercur/gi, "alkemart")
      }
      // Hide empty M-only monograms next to store name when our logo exists
      document.querySelectorAll("aside span").forEach((el) => {
        if (!(el instanceof HTMLElement)) return
        if (el.textContent?.trim() === "M" && el.children.length === 0) {
          el.textContent = "a"
          el.style.color = "#f5c518"
          el.style.fontWeight = "800"
        }
      })
    }
    run()
    const mo = new MutationObserver(() => run())
    mo.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => mo.disconnect()
  }, [])

  return null
}
