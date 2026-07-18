/**
 * Seller onboarding readiness — derived from Mercur seller lifecycle + GH checklist.
 * Lifecycle SoR remains Mercur status; this module only derives phase + checklist.
 *
 * ADR: docs/architecture/2026-07-18-seller-onboarding-product-quality-pipeline.md
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
  stock_location: boolean
  sales_channel_link: boolean
  shipping_profile: boolean
  gh_shipping_option: boolean
}

export type SellerReadiness = {
  seller_id: string
  mercur_status: MercurSellerStatus
  status_reason: string | null
  approved_at: string | null
  phase: SellerReadinessPhase
  checklist: SellerChecklist
  setup_complete: boolean
  can_propose_products: boolean
  can_create_offers: boolean
  reason_code: string | null
  next_action: { code: string; label: string } | null
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

/** Profile min for Ghana setup (ADR A.4). */
export function evaluateProfileChecklist(seller: SellerSnapshot): boolean {
  const name = str(seller.name)
  const handle = str(seller.handle)
  const email = str(seller.email)
  const currency = str(seller.currency_code).toLowerCase()
  if (!name || !handle || !email) return false
  if (currency && currency !== "ghs") return false

  const addr = seller.address
  // Address is required only when the seller record includes an address object.
  // Some graph shapes omit nested address until edited — identity alone is enough then.
  if (!addr || typeof addr !== "object") return true

  const country = str(addr.country_code).toLowerCase()
  const city = str(addr.city)
  const line = str(addr.address_1)
  if (!city && !line && !country) return true
  return Boolean(
    city &&
      line &&
      (country === "gh" || country === "gha" || country === ""),
  )
}

/**
 * Derive Alkemart readiness phase from Mercur status + checklist + approved_at.
 * rejected = suspended without ever being approved (application reject).
 */
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
  // Unknown status — treat conservatively
  return setupComplete ? "active" : "setup_incomplete"
}

export function isChecklistComplete(c: SellerChecklist): boolean {
  return (
    c.profile &&
    c.stock_location &&
    c.sales_channel_link &&
    c.shipping_profile &&
    c.gh_shipping_option
  )
}

export function nextActionFor(
  phase: SellerReadinessPhase,
  checklist: SellerChecklist,
): { code: string; label: string } | null {
  switch (phase) {
    case "pending_approval":
      return {
        code: "wait_approval",
        label: "Wait for alkemart to approve your shop",
      }
    case "rejected":
      return {
        code: "fix_application",
        label: "Update your shop details and contact support to re-apply",
      }
    case "suspended":
      return {
        code: "contact_support",
        label: "Your shop is suspended — contact support",
      }
    case "terminated":
      return {
        code: "terminated",
        label: "This shop is closed",
      }
    case "active":
      return {
        code: "list_products",
        label: "List your first product with a GHS offer",
      }
    case "setup_incomplete":
      if (!checklist.profile) {
        return {
          code: "complete_profile",
          label: "Complete shop name, handle, email, and Ghana address",
        }
      }
      if (!checklist.stock_location) {
        return {
          code: "add_stock_location",
          label: "Add a stock location (warehouse or shop)",
        }
      }
      if (!checklist.sales_channel_link) {
        return {
          code: "link_sales_channel",
          label: "Link your stock location to the storefront sales channel",
        }
      }
      if (!checklist.shipping_profile) {
        return {
          code: "add_shipping_profile",
          label: "Create a shipping profile",
        }
      }
      if (!checklist.gh_shipping_option) {
        return {
          code: "add_gh_shipping",
          label: "Add a delivery option that covers Ghana",
        }
      }
      return null
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

/** Build readiness payload from a loaded seller + checklist. Pure. */
export function buildSellerReadiness(
  seller: SellerSnapshot,
  checklist: SellerChecklist,
): SellerReadiness {
  const setup_complete = isChecklistComplete(checklist)
  const phase = deriveSellerPhase(
    seller.status,
    seller.approved_at,
    setup_complete,
  )
  const mercur = (str(seller.status).toLowerCase() ||
    "pending_approval") as MercurSellerStatus
  const canOps =
    mercur === "open" &&
    setup_complete &&
    phase === "active"

  return {
    seller_id: seller.id,
    mercur_status: mercur,
    status_reason: seller.status_reason ? str(seller.status_reason) : null,
    approved_at: isoDate(seller.approved_at),
    phase,
    checklist,
    setup_complete,
    can_propose_products: canOps,
    can_create_offers: canOps,
    reason_code: metaReasonCode(seller),
    next_action: nextActionFor(phase, checklist),
    poll_after_seconds: phase === "active" ? 0 : 20,
  }
}

async function hasStockLocation(
  query: QueryService,
  sellerId: string,
): Promise<{ ok: boolean; locationIds: string[] }> {
  try {
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "stock_locations.id"],
      filters: { id: sellerId },
    })
    const row = asList(data)[0]
    const locs = Array.isArray(row?.stock_locations)
      ? (row.stock_locations as Record<string, unknown>[])
      : []
    const locationIds = locs.map((l) => str(l.id)).filter(Boolean)
    return { ok: locationIds.length > 0, locationIds }
  } catch {
    return { ok: false, locationIds: [] }
  }
}

async function hasSalesChannelLink(
  query: QueryService,
  locationIds: string[],
): Promise<boolean> {
  if (!locationIds.length) return false
  const defaultSc = process.env.DEFAULT_SALES_CHANNEL_ID?.trim() || ""
  try {
    for (const locId of locationIds) {
      const { data } = await query.graph({
        entity: "stock_location",
        fields: ["id", "sales_channels.id"],
        filters: { id: locId },
      })
      const row = asList(data)[0]
      const channels = Array.isArray(row?.sales_channels)
        ? (row.sales_channels as Record<string, unknown>[])
        : []
      if (!channels.length) continue
      if (!defaultSc) return true
      if (channels.some((c) => str(c.id) === defaultSc)) return true
    }
  } catch {
    /* graph shape varies */
  }
  return false
}

async function hasShippingProfile(
  query: QueryService,
  sellerId: string,
): Promise<boolean> {
  try {
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "shipping_profiles.id"],
      filters: { id: sellerId },
    })
    const row = asList(data)[0]
    const profiles = Array.isArray(row?.shipping_profiles)
      ? (row.shipping_profiles as unknown[])
      : []
    if (profiles.length) return true
  } catch {
    /* fall through */
  }
  try {
    const { data } = await query.graph({
      entity: "shipping_profile",
      fields: ["id", "seller_id"],
      filters: { seller_id: sellerId },
    })
    return asList(data).length > 0
  } catch {
    return false
  }
}

function countryCodesFromZone(zone: Record<string, unknown>): string[] {
  const codes: string[] = []
  const geo = zone.geo_zones
  if (Array.isArray(geo)) {
    for (const g of geo) {
      if (g && typeof g === "object") {
        const c = str((g as Record<string, unknown>).country_code).toLowerCase()
        if (c) codes.push(c)
      }
    }
  }
  const countries = zone.countries
  if (Array.isArray(countries)) {
    for (const c of countries) {
      if (typeof c === "string") codes.push(c.toLowerCase())
      else if (c && typeof c === "object") {
        const cc = str((c as Record<string, unknown>).iso_2 || (c as Record<string, unknown>).country_code).toLowerCase()
        if (cc) codes.push(cc)
      }
    }
  }
  return codes
}

async function hasGhShippingOption(
  query: QueryService,
  sellerId: string,
): Promise<boolean> {
  try {
    const { data } = await query.graph({
      entity: "seller",
      fields: [
        "id",
        "stock_locations.id",
        "stock_locations.fulfillment_sets.id",
        "stock_locations.fulfillment_sets.service_zones.id",
        "stock_locations.fulfillment_sets.service_zones.geo_zones.country_code",
        "stock_locations.fulfillment_sets.service_zones.shipping_options.id",
      ],
      filters: { id: sellerId },
    })
    const row = asList(data)[0]
    const locs = Array.isArray(row?.stock_locations)
      ? (row.stock_locations as Record<string, unknown>[])
      : []
    for (const loc of locs) {
      const sets = Array.isArray(loc.fulfillment_sets)
        ? (loc.fulfillment_sets as Record<string, unknown>[])
        : []
      for (const fs of sets) {
        const zones = Array.isArray(fs.service_zones)
          ? (fs.service_zones as Record<string, unknown>[])
          : []
        for (const zone of zones) {
          const countries = countryCodesFromZone(zone)
          const coversGh =
            !countries.length ||
            countries.some((c) => c === "gh" || c === "gha")
          const options = Array.isArray(zone.shipping_options)
            ? zone.shipping_options
            : []
          if (coversGh && options.length > 0) return true
        }
      }
    }
  } catch {
    /* fall through */
  }
  // Best-effort: any shipping option for seller
  try {
    const { data } = await query.graph({
      entity: "shipping_option",
      fields: ["id", "seller_id"],
      filters: { seller_id: sellerId },
    })
    return asList(data).length > 0
  } catch {
    return false
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
  const { ok: stock_location, locationIds } = await hasStockLocation(
    query,
    seller.id,
  )
  const sales_channel_link = await hasSalesChannelLink(query, locationIds)
  const shipping_profile = await hasShippingProfile(query, seller.id)
  const gh_shipping_option = await hasGhShippingOption(query, seller.id)
  return {
    profile,
    stock_location,
    sales_channel_link,
    shipping_profile,
    gh_shipping_option,
  }
}

/** Full readiness evaluation for a seller id. */
export async function evaluateSellerReadiness(
  query: QueryService,
  sellerId: string,
): Promise<SellerReadiness | null> {
  const seller = await loadSellerSnapshot(query, sellerId)
  if (!seller) return null
  const checklist = await evaluateSellerChecklist(query, seller)
  return buildSellerReadiness(seller, checklist)
}

/** Strict propose/offer gates: seller must be open + setup complete. */
export function assertCanSell(
  readiness: SellerReadiness,
  action: "propose" | "offer",
): void {
  if (readiness.mercur_status === "suspended") {
    throw new Error(
      readiness.phase === "rejected"
        ? "Shop application was not approved. Contact support."
        : "Shop is suspended and cannot list products or offers.",
    )
  }
  if (readiness.mercur_status === "terminated") {
    throw new Error("Shop is terminated and cannot list products or offers.")
  }
  if (readiness.mercur_status === "pending_approval") {
    throw new Error("Shop is awaiting approval. You cannot list yet.")
  }
  if (action === "offer" && !readiness.can_create_offers) {
    throw new Error(
      readiness.next_action?.label ||
        "Finish shop setup (location + Ghana shipping) before creating offers.",
    )
  }
  if (action === "propose") {
    const strict =
      (process.env.ALKEMART_STRICT_PROPOSE_GATES ?? "true").toLowerCase() !==
      "false"
    if (strict && !readiness.can_propose_products) {
      throw new Error(
        readiness.next_action?.label ||
          "Finish shop setup before submitting products for review.",
      )
    }
    if (readiness.mercur_status !== "open") {
      throw new Error("Only approved open shops can submit products.")
    }
  }
}
