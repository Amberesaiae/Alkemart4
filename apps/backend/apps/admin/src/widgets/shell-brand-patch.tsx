import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

/**
 * No-op: shell scrubbing lives in brand-patch.ts (single observer).
 * Widget kept so zone config does not break if referenced.
 */
export const config = defineWidgetConfig({
  zone: "orders.list.before",
  id: "alkemart-shell-brand-patch",
})

export default function ShellBrandPatch() {
  return null
}
