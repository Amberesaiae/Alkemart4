import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

/**
 * No-op: shell scrubbing lives in brand-patch.ts (single observer).
 */
export const config = defineWidgetConfig({
  zone: "orders.list.before",
  id: "alkemart-shell-brand-patch",
})

export default function ShellBrandPatch() {
  return null
}
