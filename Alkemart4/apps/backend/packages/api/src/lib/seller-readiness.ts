/**
 * Seller onboarding readiness — simplified for Ghana context.
 * Only two gates: profile (name + contact) and address (pack location + region).
 * No stock locations, sales channels, shipping profiles, or shipping options.
 */

export type MercurSellerStatus =
  | "pending_approval"
  | "open"
  | "suspended"
  | "terminated"
  | string

export type SellerReadinessPhase =
  | "pending_approval"
  | "rejected"
  | "setup_incomplete"
  | "active"
  | "suspended"
  | "terminated"

export type SellerChecklist = {
  profile: boolean
  address: boolean
}

export type SellerReadiness = {
  seller_id: string
  mercur_status: MercurSellerStatus
  status_reason: string | null
  approved_at: string | null
  phase: SellerReadinessPhase
  checklist: SellerChecklist
  checklist_labels: Record<keyof SellerChecklist, string>
  setup_complete: boolean
  can_propose_products: boolean
  can_create_offers: boolean
  reason_code: string | null
  next_action: { code: string; label: string } | null
  quick_setup_available: boolean
  poll_after_seconds: number
}

export type SellerSnapshot = {
  id: string
  status?: string | null
  status_reason?: string | null
  approved_at?: string | Date | null
  name?: string | null
  handle?: string | null
  email?: string | null
  currency_code?: string | null
  metadata?: Record<string, unknown> | null
  address?: {
    address_1?: string | null
    city?: string | null
    country_code?: string | null
  } | null
}

type QueryService = {
  graph: (args: unknown) => Promise<{ data: unknown }>
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : ""
}

function isoDate(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  const s = str(v)
  return s || null
}

/** Profile check: name + email + address required. */
export function evaluateProfileChecklist(seller: SellerSnapshot): boolean {
  if (!str(seller.name) || !str(seller.email)) return false
  const addr = seller.address
  if (!addr || typeof addr !== "object") return false
  return Boolean(str(addr.address_1) && str(addr.city))
}

/** Address check: address_1 + city required for Ghana delivery. */
export function evaluateAddressChecklist(seller: SellerSnapshot): boolean {
  const addr = seller.address
  if (!addr || typeof addr !== "object") return false
  return Boolean(str(addr.address_1) && str(addr.city))
}

export function deriveSellerPhase(
  status: MercurSellerStatus | null | undefined,
  approvedAt: string | Date | null | undefined,
  setupComplete: boolean,
): SellerReadinessPhase {
  const s = str(status).toLowerCase() || "pending_approval"
  const wasApproved = Boolean(approvedAt)

  if (s === "terminated") return "terminated"
  if (s === "pending_approval") return "pending_approval"
  if (s === "suspended") {
    return wasApproved ? "suspended" : "rejected"
  }
  if (s === "open") {
    return setupComplete ? "active" : "setup_incomplete"
  }
  return setupComplete ? "active" : "setup_incomplete"
}

export function isChecklistComplete(c: SellerChecklist): boolean {
  return c.profile && c.address
}

export const CHECKLIST_LABELS: Record<keyof SellerChecklist, string> = {
  profile: "Shop name & contact",
  address: "Pack address & delivery region",
}

export function nextActionFor(
  phase: SellerReadinessPhase,
  checklist: SellerChecklist,
): { code: string; label: string } | null {
  switch (phase) {
    case "pending_approval":
      return {
        code: "wait_approval",
        label: "Under review — usually within a day. We'll email you.",
      }
    case "rejected":
      return {
        code: "fix_application",
        label: "Needs a fix — update shop details and contact support.",
      }
    case "suspended":
      return {
        code: "contact_support",
        label: "Shop paused — contact support to reopen.",
      }
    case "terminated":
      return {
        code: "terminated",
        label: "This shop is closed.",
      }
    case "active":
      return {
        code: "list_products",
        label: "Add products with photos and a GH₵ price.",
      }
    case "setup_incomplete":
      if (!checklist.profile) {
        return {
          code: "complete_profile",
          label: "Add shop name and contact.",
        }
      }
      return {
        code: "ghana_quick_setup",
        label: "Set pack address and delivery fee (GH₵).",
      }
    default:
      return null
  }
}

function metaReasonCode(seller: SellerSnapshot): string | null {
  const meta = seller.metadata
  if (!meta || typeof meta !== "object") return null
  const alk = (meta as Record<string, unknown>).alkemart
  if (!alk || typeof alk !== "object") return null
  const code = (alk as Record<string, unknown>).reason_code
  return typeof code === "string" && code.trim() ? code.trim() : null
}

export function buildSellerReadiness(
  seller: SellerSnapshot,
  checklist: SellerChecklist,
): SellerReadiness {
  const setup_complete = isChecklistComplete(checklist)
  const phase = deriveSellerPhase(seller.status, seller.approved_at, setup_complete)
  const mercur = (str(seller.status).toLowerCase() || "pending_approval") as MercurSellerStatus
  const canOps = mercur === "open"
  const canCreateOffers = canOps && setup_complete

  const next = nextActionFor(phase, checklist)
  const quick_setup_available =
    mercur === "open" && phase === "setup_incomplete" && checklist.profile

  return {
    seller_id: seller.id,
    mercur_status: mercur,
    status_reason: seller.status_reason ? str(seller.status_reason) : null,
    approved_at: isoDate(seller.approved_at),
    phase,
    checklist,
    checklist_labels: { ...CHECKLIST_LABELS },
    setup_complete,
    can_propose_products: canOps,
    can_create_offers: canCreateOffers,
    reason_code: metaReasonCode(seller),
    next_action: next,
    quick_setup_available,
    poll_after_seconds: phase === "active" ? 0 : 20,
  }
}

export async function loadSellerSnapshot(
  query: QueryService,
  sellerId: string,
): Promise<SellerSnapshot | null> {
  const { data } = await query.graph({
    entity: "seller",
    fields: [
      "id",
      "status",
      "status_reason",
      "approved_at",
      "name",
      "handle",
      "email",
      "currency_code",
      "metadata",
      "address.address_1",
      "address.city",
      "address.country_code",
    ],
    filters: { id: sellerId },
  })
  const row = asList(data)[0]
  if (!row?.id) return null
  return row as unknown as SellerSnapshot
}

export async function evaluateSellerChecklist(
  query: QueryService,
  seller: SellerSnapshot,
): Promise<SellerChecklist> {
  const profile = evaluateProfileChecklist(seller)
  const address = evaluateAddressChecklist(seller)
  return { profile, address }
}

export async function evaluateSellerReadiness(
  query: QueryService,
  sellerId: string,
): Promise<SellerReadiness | null> {
  const seller = await loadSellerSnapshot(query, sellerId)
  if (!seller) return null
  const checklist = await evaluateSellerChecklist(query, seller)
  return buildSellerReadiness(seller, checklist)
}

/** Gate: check mercur_status, setup completeness, and strict flag. */
export function assertCanSell(
  readiness: SellerReadiness,
  action: "propose" | "offer",
): void {
  if (readiness.mercur_status === "suspended") {
    throw new Error(
      readiness.phase === "rejected"
        ? "Shop application was not approved."
        : "Shop is suspended and cannot list products.",
    )
  }
  if (readiness.mercur_status === "terminated") {
    throw new Error("Shop is terminated.")
  }
  if (readiness.mercur_status === "pending_approval") {
    throw new Error("Shop is awaiting approval. You cannot list yet.")
  }
  // Incomplete setup: offers always blocked, propose blocked only in strict mode
  if (!readiness.setup_complete) {
    if (action === "offer") {
      throw new Error("Complete your shop setup before creating offers.")
    }
    if (process.env.ALKEMART_STRICT_PROPOSE_GATES === "true") {
      throw new Error("Complete your shop setup before proposing products.")
    }
  }
}
