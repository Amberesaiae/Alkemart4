import { GHANA_REGIONS } from "@alkemart/shared/ghana"
import type { ShopSettings } from "./shop"

/**
 * The first-run setup, one decision per step. Each step reuses the matching
 * Shop section, so setup and later edits are the same form.
 */
export type SetupStepId = "look" | "location" | "delivery" | "payouts" | "returns"

export const SETUP_STEPS: { id: SetupStepId; title: string; blurb: string; required: boolean }[] = [
  { id: "look", title: "Make it yours", blurb: "Your logo, name and one line about what you sell. It's the first thing buyers see.", required: false },
  { id: "location", title: "Where you dispatch from", blurb: "Search your street or stand at your shop and use your location. Buyers see how far you are; riders find you.", required: true },
  { id: "delivery", title: "How fast you deliver", blurb: "What you promise, buyers see before they pay. Promise what you can keep.", required: false },
  { id: "payouts", title: "How you get paid", blurb: "Your MoMo number for payouts. Paystack checks it before we save it.", required: true },
  { id: "returns", title: "Returns & warranty", blurb: "Clear rules mean fewer arguments. You can change them any time.", required: false },
]

export function setupDone(s: ShopSettings, hasPolicy: boolean): Record<SetupStepId, boolean> {
  return {
    look: !!s.logo && !!s.storefront.tagline,
    location: GHANA_REGIONS.some((r) => r.name === s.address?.province || r.id === s.address?.province),
    delivery: !!s.delivery.days,
    payouts: !!s.payment_details,
    returns: hasPolicy,
  }
}

export function setupProgress(s: ShopSettings, hasPolicy: boolean) {
  const done = setupDone(s, hasPolicy)
  const count = SETUP_STEPS.filter((st) => done[st.id]).length
  const firstOpen = SETUP_STEPS.find((st) => !done[st.id])?.id ?? null
  return { done, count, total: SETUP_STEPS.length, firstOpen, complete: firstOpen === null }
}
