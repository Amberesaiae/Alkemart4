import {
  campaignAudit,
  campaignEvents,
  campaigns,
  creatives,
  placements,
  productSetItems,
  productSets,
  promotionTerms,
  sellerSetItems,
  sellerSets,
} from "@alkemart/db"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/**
 * Blueprint Phase 5A — campaign engine persistence (ADR-004).
 * Statuses move draft → review → scheduled → live → ended; every mutation
 * and transition appends to the audit trail. Reads never invent inventory:
 * placements are seeded rows, and serving filters to live windows.
 */

export class CampaignValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CampaignValidationError"
  }
}

export class CampaignConflictError extends Error {
  constructor(message = "campaign already exists") {
    super(message)
    this.name = "CampaignConflictError"
  }
}

export type CampaignStatus = "draft" | "review" | "scheduled" | "live" | "ended"
export type CampaignObjective = "sale" | "launch" | "clearance" | "brand"

export type PlacementDto = {
  code: string
  job: string
  maxLive: number
  /** Serve-time guards (e.g. minimum eligible products). */
  constraints: { minProducts: number; requiresImage: boolean }
}

export type PromotionTermsDto = {
  id: string
  label: string
  summary: string
  finePrint: string | null
  startsAt: string | null
  endsAt: string | null
}

export type CreativeDto = {
  id: string
  campaignId: string
  slot: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  link: string | null
  position: number
}

export type CampaignDto = {
  id: string
  name: string
  trackingId: string
  objective: CampaignObjective
  placementCode: string
  status: CampaignStatus
  priority: number
  sponsored: boolean
  frequencyCap: number | null
  termsId: string | null
  startsAt: string | null
  endsAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type CampaignDetailDto = {
  campaign: CampaignDto
  creatives: CreativeDto[]
  productSet: { id: string; name: string; productIds: string[] } | null
  sellerSet: { id: string; name: string; sellerIds: string[] } | null
  terms: PromotionTermsDto | null
  audit: { id: string; actor: string | null; action: string; detail: unknown; createdAt: string }[]
}

export type LiveCampaignDto = CampaignDto & {
  creatives: CreativeDto[]
  productIds: string[]
  sellerIds: string[]
  terms: PromotionTermsDto | null
}

export type CampaignTransition =
  | "submit"
  | "approve"
  | "publish"
  | "end"
  | "reopen"

const TRANSITIONS: Record<CampaignTransition, { from: CampaignStatus[]; to: CampaignStatus }> = {
  submit: { from: ["draft"], to: "review" },
  approve: { from: ["review"], to: "scheduled" },
  publish: { from: ["scheduled"], to: "live" },
  end: { from: ["scheduled", "live"], to: "ended" },
  reopen: { from: ["review"], to: "draft" },
}

export interface CampaignStore {
  listPlacements(): Promise<PlacementDto[]>
  listCampaigns(status?: CampaignStatus): Promise<CampaignDto[]>
  getCampaign(id: string): Promise<CampaignDetailDto | null>
  createCampaign(input: {
    name: string
    placementCode: string
    objective?: CampaignObjective
    priority?: number
    sponsored?: boolean
    termsId?: string | null
    startsAt?: string | null
    endsAt?: string | null
    createdBy: string
  }): Promise<CampaignDto>
  updateCampaign(id: string, patch: {
    name?: string
    objective?: CampaignObjective
    placementCode?: string
    priority?: number
    sponsored?: boolean
    termsId?: string | null
    startsAt?: string | null
    endsAt?: string | null
  }): Promise<CampaignDto | null>
  transitionCampaign(id: string, action: CampaignTransition, actor: string): Promise<CampaignDto | null>
  deleteCampaign(id: string): Promise<boolean>
  createTerms(input: {
    label: string
    summary: string
    finePrint?: string | null
    startsAt?: string | null
    endsAt?: string | null
  }): Promise<PromotionTermsDto>
  listTerms(): Promise<PromotionTermsDto[]>
  addCreative(campaignId: string, input: {
    slot?: string
    title: string
    subtitle?: string | null
    imageUrl?: string | null
    link?: string | null
  }): Promise<CreativeDto>
  removeCreative(campaignId: string, creativeId: string): Promise<boolean>
  ensureProductSet(campaignId: string, name?: string): Promise<{ id: string; name: string; productIds: string[] }>
  setProductSetItems(campaignId: string, setId: string, productIds: string[]): Promise<{ id: string; name: string; productIds: string[] } | null>
  ensureSellerSet(campaignId: string, name?: string): Promise<{ id: string; name: string; sellerIds: string[] }>
  setSellerSetItems(campaignId: string, setId: string, sellerIds: string[]): Promise<{ id: string; name: string; sellerIds: string[] } | null>
  /** Live-window campaigns with sets, creatives, and terms for the course. */
  listLiveCampaigns(now?: Date): Promise<LiveCampaignDto[]>
  /** Expired live/scheduled campaigns flip to ended (auto-offline). */
  sweepExpired(now?: Date): Promise<string[]>
  recordEvent(campaignId: string, input: {
    placementCode: string
    creativeId?: string | null
    position?: number | null
    event: "view" | "select"
  }): Promise<void>
  reportCampaign(id: string): Promise<{
    views: number
    selects: number
    byPlacement: { placementCode: string; views: number; selects: number }[]
    byCreative: { creativeId: string; views: number; selects: number }[]
  } | null>
}

function slugify(input: string): string {
  const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return slug || "campaign"
}

function cleanText(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

function parseMoment(raw: string | null | undefined, field: string): Date | null {
  if (raw == null || raw === "") return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw new CampaignValidationError(`${field} is not a valid date`)
  return d
}

const PLACEMENT_SEED: PlacementDto[] = [
  { code: "hero", job: "Homepage hero", maxLive: 1, constraints: { minProducts: 1, requiresImage: true } },
  { code: "deal_rail", job: "Deal rail", maxLive: 1, constraints: { minProducts: 2, requiresImage: true } },
  { code: "promo_grid", job: "Promo grid", maxLive: 2, constraints: { minProducts: 2, requiresImage: false } },
  { code: "promo_band", job: "Promo band", maxLive: 1, constraints: { minProducts: 1, requiresImage: false } },
  { code: "marquee", job: "Marquee strip", maxLive: 1, constraints: { minProducts: 0, requiresImage: false } },
]

function readConstraints(raw: unknown): PlacementDto["constraints"] {
  const fallback = { minProducts: 1, requiresImage: false }
  if (!raw || typeof raw !== "object") return fallback
  const r = raw as Record<string, unknown>
  return {
    minProducts:
      typeof r.minProducts === "number" && Number.isInteger(r.minProducts) && r.minProducts >= 0
        ? r.minProducts
        : fallback.minProducts,
    requiresImage: r.requiresImage === true,
  }
}

type StoredCampaign = {
  id: string
  name: string
  trackingId: string
  objective: CampaignObjective
  placementCode: string
  status: CampaignStatus
  priority: number
  sponsored: boolean
  frequencyCap: number | null
  termsId: string | null
  startsAt: string | null
  endsAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

function campaignToDto(c: StoredCampaign): CampaignDto {
  return { ...c }
}

export class InMemoryCampaignStore implements CampaignStore {
  private campaigns = new Map<string, StoredCampaign>()
  private terms = new Map<string, PromotionTermsDto>()
  private creatives = new Map<string, CreativeDto>()
  private productSets = new Map<string, { id: string; campaignId: string; name: string; productIds: string[] }>()
  private sellerSets = new Map<string, { id: string; campaignId: string; name: string; sellerIds: string[] }>()
  private audit: { id: string; campaignId: string; actor: string | null; action: string; detail: unknown; createdAt: string }[] = []
  private events: { campaignId: string; placementCode: string; creativeId: string | null; position: number | null; event: "view" | "select"; createdAt: string }[] = []

  constructor(
    private readonly productExists: (productId: string) => boolean = () => true,
    private readonly sellerExists: (sellerId: string) => boolean = () => true,
  ) {}

  private log(campaignId: string, actor: string | null, action: string, detail: unknown = null) {
    this.audit.push({
      id: crypto.randomUUID(),
      campaignId,
      actor,
      action,
      detail,
      createdAt: new Date().toISOString(),
    })
  }

  async listPlacements(): Promise<PlacementDto[]> {
    return PLACEMENT_SEED.map((p) => ({ ...p }))
  }

  async listCampaigns(status?: CampaignStatus): Promise<CampaignDto[]> {
    return [...this.campaigns.values()]
      .filter((c) => !status || c.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      .map(campaignToDto)
  }

  async getCampaign(id: string): Promise<CampaignDetailDto | null> {
    const c = this.campaigns.get(id)
    if (!c) return null
    const pset = [...this.productSets.values()].find((s) => s.campaignId === id) ?? null
    const sset = [...this.sellerSets.values()].find((s) => s.campaignId === id) ?? null
    return {
      campaign: campaignToDto(c),
      creatives: [...this.creatives.values()]
        .filter((r) => r.campaignId === id)
        .sort((a, b) => a.position - b.position),
      productSet: pset ? { id: pset.id, name: pset.name, productIds: [...pset.productIds] } : null,
      sellerSet: sset ? { id: sset.id, name: sset.name, sellerIds: [...sset.sellerIds] } : null,
      terms: c.termsId ? (this.terms.get(c.termsId) ?? null) : null,
      audit: this.audit.filter((a) => a.campaignId === id),
    }
  }

  async createCampaign(input: {
    name: string
    placementCode: string
    objective?: CampaignObjective
    priority?: number
    sponsored?: boolean
    termsId?: string | null
    startsAt?: string | null
    endsAt?: string | null
    createdBy: string
  }): Promise<CampaignDto> {
    const name = input.name?.trim()
    if (!name) throw new CampaignValidationError("name required")
    if (name.length > 120) throw new CampaignValidationError("name must be 120 characters or fewer")
    if (!PLACEMENT_SEED.some((p) => p.code === input.placementCode)) {
      throw new CampaignValidationError(`unknown placement: ${input.placementCode}`)
    }
    if (input.termsId && !this.terms.has(input.termsId)) {
      throw new CampaignValidationError("unknown terms")
    }
    const startsAt = parseMoment(input.startsAt, "startsAt")
    const endsAt = parseMoment(input.endsAt, "endsAt")
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new CampaignValidationError("endsAt must be after startsAt")
    }
    if (input.priority !== undefined && (!Number.isInteger(input.priority) || input.priority < 0)) {
      throw new CampaignValidationError("priority must be a whole number >= 0")
    }
    if (!input.createdBy?.trim()) throw new CampaignValidationError("createdBy required")
    const now = new Date().toISOString()
    const c: StoredCampaign = {
      id: crypto.randomUUID(),
      name,
      trackingId: `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`,
      objective: input.objective ?? "sale",
      placementCode: input.placementCode,
      status: "draft",
      priority: input.priority ?? 0,
      sponsored: input.sponsored ?? false,
      frequencyCap: null,
      termsId: input.termsId ?? null,
      startsAt: startsAt ? startsAt.toISOString() : null,
      endsAt: endsAt ? endsAt.toISOString() : null,
      createdBy: input.createdBy.trim(),
      createdAt: now,
      updatedAt: now,
    }
    this.campaigns.set(c.id, c)
    this.log(c.id, c.createdBy, "create", { name, placementCode: c.placementCode })
    return campaignToDto(c)
  }

  async updateCampaign(id: string, patch: {
    name?: string
    objective?: CampaignObjective
    placementCode?: string
    priority?: number
    sponsored?: boolean
    termsId?: string | null
    startsAt?: string | null
    endsAt?: string | null
  }): Promise<CampaignDto | null> {
    const c = this.campaigns.get(id)
    if (!c) return null
    if (c.status !== "draft" && c.status !== "review") {
      throw new CampaignValidationError(`campaigns in ${c.status} are read-only; end it to stop serving`)
    }
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (!name) throw new CampaignValidationError("name required")
      if (name.length > 120) throw new CampaignValidationError("name must be 120 characters or fewer")
      c.name = name
    }
    if (patch.objective !== undefined) c.objective = patch.objective
    if (patch.placementCode !== undefined) {
      if (!PLACEMENT_SEED.some((p) => p.code === patch.placementCode)) {
        throw new CampaignValidationError(`unknown placement: ${patch.placementCode}`)
      }
      c.placementCode = patch.placementCode
    }
    if (patch.priority !== undefined) {
      if (!Number.isInteger(patch.priority) || patch.priority < 0) {
        throw new CampaignValidationError("priority must be a whole number >= 0")
      }
      c.priority = patch.priority
    }
    if (patch.sponsored !== undefined) c.sponsored = patch.sponsored
    if (patch.termsId !== undefined) {
      if (patch.termsId && !this.terms.has(patch.termsId)) {
        throw new CampaignValidationError("unknown terms")
      }
      c.termsId = patch.termsId
    }
    const startsAt = patch.startsAt !== undefined ? parseMoment(patch.startsAt, "startsAt") : null
    const endsAt = patch.endsAt !== undefined ? parseMoment(patch.endsAt, "endsAt") : null
    const nextStart = startsAt ?? (c.startsAt ? new Date(c.startsAt) : null)
    const nextEnd = endsAt ?? (c.endsAt ? new Date(c.endsAt) : null)
    if (nextStart && nextEnd && nextEnd.getTime() <= nextStart.getTime()) {
      throw new CampaignValidationError("endsAt must be after startsAt")
    }
    if (patch.startsAt !== undefined) c.startsAt = startsAt ? startsAt.toISOString() : null
    if (patch.endsAt !== undefined) c.endsAt = endsAt ? endsAt.toISOString() : null
    c.updatedAt = new Date().toISOString()
    this.log(c.id, null, "update", patch)
    return campaignToDto(c)
  }

  async transitionCampaign(id: string, action: CampaignTransition, actor: string): Promise<CampaignDto | null> {
    const c = this.campaigns.get(id)
    if (!c) return null
    const rule = TRANSITIONS[action]
    if (!rule.from.includes(c.status)) {
      throw new CampaignValidationError(`cannot ${action} a ${c.status} campaign`)
    }
    if (!actor?.trim()) throw new CampaignValidationError("actor required")
    const now = new Date()
    if (action === "approve" && !c.startsAt) {
      throw new CampaignValidationError("schedule a start before approving")
    }
    if (action === "publish") {
      if (c.startsAt && new Date(c.startsAt).getTime() > now.getTime()) {
        throw new CampaignValidationError("campaign starts in the future; it goes live on schedule")
      }
      if ([...this.productSets.values()].find((s) => s.campaignId === id)?.productIds.length === 0) {
        throw new CampaignValidationError("attach at least one product before publishing")
      }
      if (![...this.creatives.values()].some((r) => r.campaignId === id)) {
        throw new CampaignValidationError("add at least one creative before publishing")
      }
    }
    c.status = rule.to
    c.updatedAt = now.toISOString()
    this.log(c.id, actor.trim(), action, { from: rule.from, to: rule.to })
    return campaignToDto(c)
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const c = this.campaigns.get(id)
    if (!c) return false
    if (c.status !== "draft") {
      throw new CampaignValidationError("only drafts delete; end a live campaign instead")
    }
    this.campaigns.delete(id)
    for (const [k, r] of this.creatives) if (r.campaignId === id) this.creatives.delete(k)
    for (const [k, s] of this.productSets) if (s.campaignId === id) this.productSets.delete(k)
    for (const [k, s] of this.sellerSets) if (s.campaignId === id) this.sellerSets.delete(k)
    this.audit = this.audit.filter((a) => a.campaignId !== id)
    return true
  }

  async createTerms(input: {
    label: string
    summary: string
    finePrint?: string | null
    startsAt?: string | null
    endsAt?: string | null
  }): Promise<PromotionTermsDto> {
    const label = input.label?.trim()
    const summary = input.summary?.trim()
    if (!label) throw new CampaignValidationError("label required")
    if (!summary) throw new CampaignValidationError("summary required")
    if (label.length > 120) throw new CampaignValidationError("label must be 120 characters or fewer")
    if (summary.length > 2000) throw new CampaignValidationError("summary must be 2000 characters or fewer")
    const startsAt = parseMoment(input.startsAt, "startsAt")
    const endsAt = parseMoment(input.endsAt, "endsAt")
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new CampaignValidationError("endsAt must be after startsAt")
    }
    const terms: PromotionTermsDto = {
      id: crypto.randomUUID(),
      label,
      summary,
      finePrint: cleanText(input.finePrint),
      startsAt: startsAt ? startsAt.toISOString() : null,
      endsAt: endsAt ? endsAt.toISOString() : null,
    }
    this.terms.set(terms.id, terms)
    return { ...terms }
  }

  async listTerms(): Promise<PromotionTermsDto[]> {
    return [...this.terms.values()].map((t) => ({ ...t }))
  }

  private requireCampaign(campaignId: string) {
    const c = this.campaigns.get(campaignId)
    if (!c) throw new CampaignValidationError("unknown campaign")
    return c
  }

  async addCreative(campaignId: string, input: {
    slot?: string
    title: string
    subtitle?: string | null
    imageUrl?: string | null
    link?: string | null
  }): Promise<CreativeDto> {
    this.requireCampaign(campaignId)
    const title = input.title?.trim()
    if (!title) throw new CampaignValidationError("title required")
    if (title.length > 120) throw new CampaignValidationError("title must be 120 characters or fewer")
    const slot = (input.slot?.trim() || "desktop").toLowerCase()
    if (slot !== "desktop" && slot !== "mobile") {
      throw new CampaignValidationError("slot must be desktop or mobile")
    }
    const position = [...this.creatives.values()].filter(
      (r) => r.campaignId === campaignId && r.slot === slot,
    ).length
    const creative: CreativeDto = {
      id: crypto.randomUUID(),
      campaignId,
      slot,
      title,
      subtitle: cleanText(input.subtitle),
      imageUrl: cleanText(input.imageUrl),
      link: cleanText(input.link),
      position,
    }
    this.creatives.set(creative.id, creative)
    this.log(campaignId, null, "creative.add", { id: creative.id, slot })
    return { ...creative }
  }

  async removeCreative(campaignId: string, creativeId: string): Promise<boolean> {
    const row = this.creatives.get(creativeId)
    if (!row || row.campaignId !== campaignId) return false
    this.creatives.delete(creativeId)
    this.log(campaignId, null, "creative.remove", { id: creativeId })
    return true
  }

  async ensureProductSet(campaignId: string, name = "Products") {
    this.requireCampaign(campaignId)
    const existing = [...this.productSets.values()].find((s) => s.campaignId === campaignId)
    if (existing) return { id: existing.id, name: existing.name, productIds: [...existing.productIds] }
    const set = { id: crypto.randomUUID(), campaignId, name, productIds: [] as string[] }
    this.productSets.set(set.id, set)
    return { id: set.id, name: set.name, productIds: [] }
  }

  async setProductSetItems(campaignId: string, setId: string, productIds: string[]) {
    const set = this.productSets.get(setId)
    if (!set || set.campaignId !== campaignId) return null
    if (productIds.length > 50) throw new CampaignValidationError("at most 50 products per set")
    if (new Set(productIds).size !== productIds.length) {
      throw new CampaignValidationError("duplicate products")
    }
    for (const pid of productIds) {
      if (!this.productExists(pid)) throw new CampaignValidationError(`unknown product: ${pid}`)
    }
    set.productIds = [...productIds]
    this.log(campaignId, null, "products.set", { setId, count: productIds.length })
    return { id: set.id, name: set.name, productIds: [...set.productIds] }
  }

  async ensureSellerSet(campaignId: string, name = "Sellers") {
    this.requireCampaign(campaignId)
    const existing = [...this.sellerSets.values()].find((s) => s.campaignId === campaignId)
    if (existing) return { id: existing.id, name: existing.name, sellerIds: [...existing.sellerIds] }
    const set = { id: crypto.randomUUID(), campaignId, name, sellerIds: [] as string[] }
    this.sellerSets.set(set.id, set)
    return { id: set.id, name: set.name, sellerIds: [] }
  }

  async setSellerSetItems(campaignId: string, setId: string, sellerIds: string[]) {
    const set = this.sellerSets.get(setId)
    if (!set || set.campaignId !== campaignId) return null
    if (sellerIds.length > 50) throw new CampaignValidationError("at most 50 sellers per set")
    if (new Set(sellerIds).size !== sellerIds.length) {
      throw new CampaignValidationError("duplicate sellers")
    }
    for (const sid of sellerIds) {
      if (!this.sellerExists(sid)) throw new CampaignValidationError(`unknown seller: ${sid}`)
    }
    set.sellerIds = [...sellerIds]
    this.log(campaignId, null, "sellers.set", { setId, count: sellerIds.length })
    return { id: set.id, name: set.name, sellerIds: [...set.sellerIds] }
  }

  async listLiveCampaigns(now: Date = new Date()): Promise<LiveCampaignDto[]> {
    const out: LiveCampaignDto[] = []
    for (const c of this.campaigns.values()) {
      if (c.status !== "live") continue
      if (c.startsAt && new Date(c.startsAt).getTime() > now.getTime()) continue
      if (c.endsAt && new Date(c.endsAt).getTime() <= now.getTime()) continue
      const pset = [...this.productSets.values()].find((s) => s.campaignId === c.id)
      const sset = [...this.sellerSets.values()].find((s) => s.campaignId === c.id)
      out.push({
        ...campaignToDto(c),
        creatives: [...this.creatives.values()]
          .filter((r) => r.campaignId === c.id)
          .sort((a, b) => a.position - b.position),
        productIds: pset ? [...pset.productIds] : [],
        sellerIds: sset ? [...sset.sellerIds] : [],
        terms: c.termsId ? (this.terms.get(c.termsId) ?? null) : null,
      })
    }
    return out
  }

  async sweepExpired(now: Date = new Date()): Promise<string[]> {
    const flipped: string[] = []
    for (const c of this.campaigns.values()) {
      if ((c.status === "live" || c.status === "scheduled") && c.endsAt && new Date(c.endsAt).getTime() <= now.getTime()) {
        c.status = "ended"
        c.updatedAt = now.toISOString()
        this.log(c.id, null, "auto-expire", { at: now.toISOString() })
        flipped.push(c.id)
      }
    }
    return flipped
  }

  async recordEvent(campaignId: string, input: {
    placementCode: string
    creativeId?: string | null
    position?: number | null
    event: "view" | "select"
  }): Promise<void> {
    if (!this.campaigns.has(campaignId)) return
    this.events.push({
      campaignId,
      placementCode: input.placementCode,
      creativeId: input.creativeId ?? null,
      position: input.position ?? null,
      event: input.event,
      createdAt: new Date().toISOString(),
    })
  }

  async reportCampaign(id: string) {
    if (!this.campaigns.has(id)) return null
    const rows = this.events.filter((e) => e.campaignId === id)
    const views = rows.filter((e) => e.event === "view").length
    const selects = rows.filter((e) => e.event === "select").length
    const byPlacement = new Map<string, { views: number; selects: number }>()
    const byCreative = new Map<string, { views: number; selects: number }>()
    for (const e of rows) {
      const p = byPlacement.get(e.placementCode) ?? { views: 0, selects: 0 }
      p[e.event === "view" ? "views" : "selects"] += 1
      byPlacement.set(e.placementCode, p)
      const key = e.creativeId ?? "(none)"
      const cr = byCreative.get(key) ?? { views: 0, selects: 0 }
      cr[e.event === "view" ? "views" : "selects"] += 1
      byCreative.set(key, cr)
    }
    return {
      views,
      selects,
      byPlacement: [...byPlacement.entries()].map(([placementCode, v]) => ({ placementCode, ...v })),
      byCreative: [...byCreative.entries()].map(([creativeId, v]) => ({ creativeId, ...v })),
    }
  }
}

function rowToCampaignDto(row: typeof campaigns.$inferSelect): CampaignDto {
  return {
    id: row.id,
    name: row.name,
    trackingId: row.trackingId,
    objective: row.objective,
    placementCode: row.placementCode,
    status: row.status,
    priority: row.priority,
    sponsored: row.sponsored === 1,
    frequencyCap: row.frequencyCap,
    termsId: row.termsId,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    createdBy: row.createdBy,
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date(0).toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : new Date(0).toISOString(),
  }
}

export class PostgresCampaignStore implements CampaignStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  private async audit(campaignId: string, actor: string | null, action: string, detail: unknown = null) {
    try {
      await this.db.insert(campaignAudit).values({ id: crypto.randomUUID(), campaignId, actor, action, detail })
    } catch {
      /* audit loss must not fail commerce writes */
    }
  }

  async listPlacements(): Promise<PlacementDto[]> {
    try {
      const rows = await this.db.select().from(placements)
      if (rows.length === 0) return PLACEMENT_SEED.map((p) => ({ ...p }))
      return rows.map((r) => ({
        code: r.code,
        job: r.job,
        maxLive: r.maxLive,
        constraints: readConstraints(r.constraints),
      }))
    } catch {
      return PLACEMENT_SEED.map((p) => ({ ...p }))
    }
  }

  async listCampaigns(status?: CampaignStatus): Promise<CampaignDto[]> {
    const rows = await this.db
      .select()
      .from(campaigns)
      .where(status ? eq(campaigns.status, status) : undefined)
      .orderBy(desc(campaigns.createdAt))
    return rows.map(rowToCampaignDto)
  }

  async getCampaign(id: string): Promise<CampaignDetailDto | null> {
    const [row] = await this.db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1)
    if (!row) return null
    const [creativeRows, psetRows, ssetRows, auditRows] = await Promise.all([
      this.db.select().from(creatives).where(eq(creatives.campaignId, id)).orderBy(asc(creatives.position)),
      this.db.select().from(productSets).where(eq(productSets.campaignId, id)).limit(1),
      this.db.select().from(sellerSets).where(eq(sellerSets.campaignId, id)).limit(1),
      this.db.select().from(campaignAudit).where(eq(campaignAudit.campaignId, id)).orderBy(asc(campaignAudit.createdAt)),
    ])
    const pset = psetRows[0] ?? null
    const sset = ssetRows[0] ?? null
    const [pItems, sItems] = await Promise.all([
      pset
        ? this.db.select().from(productSetItems).where(eq(productSetItems.setId, pset.id)).orderBy(asc(productSetItems.position))
        : Promise.resolve([]),
      sset
        ? this.db.select().from(sellerSetItems).where(eq(sellerSetItems.setId, sset.id)).orderBy(asc(sellerSetItems.position))
        : Promise.resolve([]),
    ])
    const [termsRow] = row.termsId
      ? await this.db.select().from(promotionTerms).where(eq(promotionTerms.id, row.termsId)).limit(1)
      : [null]
    return {
      campaign: rowToCampaignDto(row),
      creatives: creativeRows.map((r) => ({
        id: r.id,
        campaignId: r.campaignId,
        slot: r.slot,
        title: r.title,
        subtitle: r.subtitle,
        imageUrl: r.imageUrl,
        link: r.link,
        position: r.position,
      })),
      productSet: pset ? { id: pset.id, name: pset.name, productIds: pItems.map((i) => i.productId) } : null,
      sellerSet: sset ? { id: sset.id, name: sset.name, sellerIds: sItems.map((i) => i.sellerId) } : null,
      terms: termsRow
        ? {
            id: termsRow.id,
            label: termsRow.label,
            summary: termsRow.summary,
            finePrint: termsRow.finePrint,
            startsAt: termsRow.startsAt ? termsRow.startsAt.toISOString() : null,
            endsAt: termsRow.endsAt ? termsRow.endsAt.toISOString() : null,
          }
        : null,
      audit: auditRows.map((a) => ({
        id: a.id,
        actor: a.actor,
        action: a.action,
        detail: a.detail,
        createdAt: a.createdAt ? a.createdAt.toISOString() : new Date(0).toISOString(),
      })),
    }
  }

  async createCampaign(input: {
    name: string
    placementCode: string
    objective?: CampaignObjective
    priority?: number
    sponsored?: boolean
    termsId?: string | null
    startsAt?: string | null
    endsAt?: string | null
    createdBy: string
  }): Promise<CampaignDto> {
    const name = input.name?.trim()
    if (!name) throw new CampaignValidationError("name required")
    if (name.length > 120) throw new CampaignValidationError("name must be 120 characters or fewer")
    const [placement] = await this.db
      .select({ code: placements.code })
      .from(placements)
      .where(eq(placements.code, input.placementCode))
      .limit(1)
      .catch(() => [])
    const known = placement ?? (PLACEMENT_SEED.some((p) => p.code === input.placementCode) ? { code: input.placementCode } : null)
    if (!known) throw new CampaignValidationError(`unknown placement: ${input.placementCode}`)
    if (input.termsId) {
      const [t] = await this.db.select({ id: promotionTerms.id }).from(promotionTerms).where(eq(promotionTerms.id, input.termsId)).limit(1)
      if (!t) throw new CampaignValidationError("unknown terms")
    }
    const startsAt = parseMoment(input.startsAt, "startsAt")
    const endsAt = parseMoment(input.endsAt, "endsAt")
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new CampaignValidationError("endsAt must be after startsAt")
    }
    if (input.priority !== undefined && (!Number.isInteger(input.priority) || input.priority < 0)) {
      throw new CampaignValidationError("priority must be a whole number >= 0")
    }
    if (!input.createdBy?.trim()) throw new CampaignValidationError("createdBy required")
    const id = crypto.randomUUID()
    const now = new Date()
    const [row] = await this.db
      .insert(campaigns)
      .values({
        id,
        name,
        trackingId: `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`,
        objective: input.objective ?? "sale",
        placementCode: input.placementCode,
        status: "draft",
        priority: input.priority ?? 0,
        sponsored: input.sponsored ? 1 : 0,
        termsId: input.termsId ?? null,
        startsAt,
        endsAt,
        createdBy: input.createdBy.trim(),
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!row) throw new Error("campaign insert failed")
    await this.audit(id, row.createdBy, "create", { name, placementCode: row.placementCode })
    return rowToCampaignDto(row)
  }

  async updateCampaign(id: string, patch: {
    name?: string
    objective?: CampaignObjective
    placementCode?: string
    priority?: number
    sponsored?: boolean
    termsId?: string | null
    startsAt?: string | null
    endsAt?: string | null
  }): Promise<CampaignDto | null> {
    const [row] = await this.db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1)
    if (!row) return null
    if (row.status !== "draft" && row.status !== "review") {
      throw new CampaignValidationError(`campaigns in ${row.status} are read-only; end it to stop serving`)
    }
    const set: Partial<typeof campaigns.$inferInsert> = {}
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (!name) throw new CampaignValidationError("name required")
      if (name.length > 120) throw new CampaignValidationError("name must be 120 characters or fewer")
      set.name = name
    }
    if (patch.objective !== undefined) set.objective = patch.objective
    if (patch.placementCode !== undefined) {
      const [placement] = await this.db
        .select({ code: placements.code })
        .from(placements)
        .where(eq(placements.code, patch.placementCode))
        .limit(1)
        .catch(() => [])
      const known = placement ?? (PLACEMENT_SEED.some((p) => p.code === patch.placementCode as string) ? { code: patch.placementCode } : null)
      if (!known) throw new CampaignValidationError(`unknown placement: ${patch.placementCode}`)
      set.placementCode = patch.placementCode
    }
    if (patch.priority !== undefined) {
      if (!Number.isInteger(patch.priority) || patch.priority < 0) {
        throw new CampaignValidationError("priority must be a whole number >= 0")
      }
      set.priority = patch.priority
    }
    if (patch.sponsored !== undefined) set.sponsored = patch.sponsored ? 1 : 0
    if (patch.termsId !== undefined) {
      if (patch.termsId) {
        const [t] = await this.db.select({ id: promotionTerms.id }).from(promotionTerms).where(eq(promotionTerms.id, patch.termsId)).limit(1)
        if (!t) throw new CampaignValidationError("unknown terms")
      }
      set.termsId = patch.termsId
    }
    const startsAt = patch.startsAt !== undefined ? parseMoment(patch.startsAt, "startsAt") : null
    const endsAt = patch.endsAt !== undefined ? parseMoment(patch.endsAt, "endsAt") : null
    const nextStart = startsAt ?? row.startsAt
    const nextEnd = endsAt ?? row.endsAt
    if (nextStart && nextEnd && nextEnd.getTime() <= nextStart.getTime()) {
      throw new CampaignValidationError("endsAt must be after startsAt")
    }
    if (patch.startsAt !== undefined) set.startsAt = startsAt
    if (patch.endsAt !== undefined) set.endsAt = endsAt
    set.updatedAt = new Date()
    if (Object.keys(set).length > 0) {
      await this.db.update(campaigns).set(set).where(eq(campaigns.id, id))
    }
    await this.audit(id, null, "update", patch)
    const [fresh] = await this.db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1)
    if (!fresh) return null
    return rowToCampaignDto(fresh)
  }

  async transitionCampaign(id: string, action: CampaignTransition, actor: string): Promise<CampaignDto | null> {
    const [row] = await this.db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1)
    if (!row) return null
    const rule = TRANSITIONS[action]
    if (!rule.from.includes(row.status as CampaignStatus)) {
      throw new CampaignValidationError(`cannot ${action} a ${row.status} campaign`)
    }
    if (!actor?.trim()) throw new CampaignValidationError("actor required")
    const now = new Date()
    if (action === "approve" && !row.startsAt) {
      throw new CampaignValidationError("schedule a start before approving")
    }
    if (action === "publish") {
      if (row.startsAt && row.startsAt.getTime() > now.getTime()) {
        throw new CampaignValidationError("campaign starts in the future; it goes live on schedule")
      }
      const [pset] = await this.db.select({ id: productSets.id }).from(productSets).where(eq(productSets.campaignId, id)).limit(1)
      const items = pset
        ? await this.db.select({ id: productSetItems.id }).from(productSetItems).where(eq(productSetItems.setId, pset.id)).limit(1)
        : []
      if (items.length === 0) throw new CampaignValidationError("attach at least one product before publishing")
      const creative = await this.db.select({ id: creatives.id }).from(creatives).where(eq(creatives.campaignId, id)).limit(1)
      if (creative.length === 0) throw new CampaignValidationError("add at least one creative before publishing")
    }
    const [updated] = await this.db
      .update(campaigns)
      .set({ status: rule.to, updatedAt: now })
      .where(eq(campaigns.id, id))
      .returning()
    if (!updated) return null
    await this.audit(id, actor.trim(), action, { to: rule.to })
    return rowToCampaignDto(updated)
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const [row] = await this.db.select({ status: campaigns.status }).from(campaigns).where(eq(campaigns.id, id)).limit(1)
    if (!row) return false
    if (row.status !== "draft") {
      throw new CampaignValidationError("only drafts delete; end a live campaign instead")
    }
    await this.db.transaction(async (tx) => {
      const psets = await tx.select({ id: productSets.id }).from(productSets).where(eq(productSets.campaignId, id))
      for (const s of psets) {
        await tx.delete(productSetItems).where(eq(productSetItems.setId, s.id))
      }
      await tx.delete(productSets).where(eq(productSets.campaignId, id))
      const ssets = await tx.select({ id: sellerSets.id }).from(sellerSets).where(eq(sellerSets.campaignId, id))
      for (const s of ssets) {
        await tx.delete(sellerSetItems).where(eq(sellerSetItems.setId, s.id))
      }
      await tx.delete(sellerSets).where(eq(sellerSets.campaignId, id))
      await tx.delete(creatives).where(eq(creatives.campaignId, id))
      await tx.delete(campaignAudit).where(eq(campaignAudit.campaignId, id))
      await tx.delete(campaigns).where(eq(campaigns.id, id))
    })
    return true
  }

  async createTerms(input: {
    label: string
    summary: string
    finePrint?: string | null
    startsAt?: string | null
    endsAt?: string | null
  }): Promise<PromotionTermsDto> {
    const label = input.label?.trim()
    const summary = input.summary?.trim()
    if (!label) throw new CampaignValidationError("label required")
    if (!summary) throw new CampaignValidationError("summary required")
    if (label.length > 120) throw new CampaignValidationError("label must be 120 characters or fewer")
    if (summary.length > 2000) throw new CampaignValidationError("summary must be 2000 characters or fewer")
    const startsAt = parseMoment(input.startsAt, "startsAt")
    const endsAt = parseMoment(input.endsAt, "endsAt")
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new CampaignValidationError("endsAt must be after startsAt")
    }
    const [row] = await this.db
      .insert(promotionTerms)
      .values({ id: crypto.randomUUID(), label, summary, finePrint: cleanText(input.finePrint), startsAt, endsAt })
      .returning()
    if (!row) throw new Error("terms insert failed")
    return {
      id: row.id,
      label: row.label,
      summary: row.summary,
      finePrint: row.finePrint,
      startsAt: row.startsAt ? row.startsAt.toISOString() : null,
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    }
  }

  async listTerms(): Promise<PromotionTermsDto[]> {
    const rows = await this.db.select().from(promotionTerms).orderBy(desc(promotionTerms.createdAt))
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      summary: row.summary,
      finePrint: row.finePrint,
      startsAt: row.startsAt ? row.startsAt.toISOString() : null,
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    }))
  }

  async addCreative(campaignId: string, input: {
    slot?: string
    title: string
    subtitle?: string | null
    imageUrl?: string | null
    link?: string | null
  }): Promise<CreativeDto> {
    const [c] = await this.db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1)
    if (!c) throw new CampaignValidationError("unknown campaign")
    const title = input.title?.trim()
    if (!title) throw new CampaignValidationError("title required")
    if (title.length > 120) throw new CampaignValidationError("title must be 120 characters or fewer")
    const slot = (input.slot?.trim() || "desktop").toLowerCase()
    if (slot !== "desktop" && slot !== "mobile") {
      throw new CampaignValidationError("slot must be desktop or mobile")
    }
    const existing = await this.db
      .select({ id: creatives.id })
      .from(creatives)
      .where(and(eq(creatives.campaignId, campaignId), eq(creatives.slot, slot)))
    const [row] = await this.db
      .insert(creatives)
      .values({
        id: crypto.randomUUID(),
        campaignId,
        slot,
        title,
        subtitle: cleanText(input.subtitle),
        imageUrl: cleanText(input.imageUrl),
        link: cleanText(input.link),
        position: existing.length,
      })
      .returning()
    if (!row) throw new Error("creative insert failed")
    await this.audit(campaignId, null, "creative.add", { id: row.id, slot })
    return {
      id: row.id,
      campaignId: row.campaignId,
      slot: row.slot,
      title: row.title,
      subtitle: row.subtitle,
      imageUrl: row.imageUrl,
      link: row.link,
      position: row.position,
    }
  }

  async removeCreative(campaignId: string, creativeId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ campaignId: creatives.campaignId })
      .from(creatives)
      .where(eq(creatives.id, creativeId))
      .limit(1)
    if (!row || row.campaignId !== campaignId) return false
    await this.db.delete(creatives).where(eq(creatives.id, creativeId))
    await this.audit(campaignId, null, "creative.remove", { id: creativeId })
    return true
  }

  async ensureProductSet(campaignId: string, name = "Products") {
    const [c] = await this.db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1)
    if (!c) throw new CampaignValidationError("unknown campaign")
    const [existing] = await this.db.select().from(productSets).where(eq(productSets.campaignId, campaignId)).limit(1)
    if (existing) {
      const items = await this.db.select().from(productSetItems).where(eq(productSetItems.setId, existing.id)).orderBy(asc(productSetItems.position))
      return { id: existing.id, name: existing.name, productIds: items.map((i) => i.productId) }
    }
    const [set] = await this.db
      .insert(productSets)
      .values({ id: crypto.randomUUID(), campaignId, name })
      .returning()
    if (!set) throw new Error("product set insert failed")
    return { id: set.id, name: set.name, productIds: [] as string[] }
  }

  async setProductSetItems(campaignId: string, setId: string, productIds: string[]) {
    const { products } = await import("@alkemart/db")
    const [set] = await this.db.select().from(productSets).where(eq(productSets.id, setId)).limit(1)
    if (!set || set.campaignId !== campaignId) return null
    if (productIds.length > 50) throw new CampaignValidationError("at most 50 products per set")
    if (new Set(productIds).size !== productIds.length) {
      throw new CampaignValidationError("duplicate products")
    }
    if (productIds.length > 0) {
      const found = await this.db
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.id, productIds))
      const known = new Set(found.map((f) => f.id))
      for (const pid of productIds) {
        if (!known.has(pid)) throw new CampaignValidationError(`unknown product: ${pid}`)
      }
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(productSetItems).where(eq(productSetItems.setId, setId))
      if (productIds.length > 0) {
        await tx.insert(productSetItems).values(
          productIds.map((productId, i) => ({ id: crypto.randomUUID(), setId, productId, position: i })),
        )
      }
    })
    await this.audit(campaignId, null, "products.set", { setId, count: productIds.length })
    return { id: set.id, name: set.name, productIds: [...productIds] }
  }

  async ensureSellerSet(campaignId: string, name = "Sellers") {
    const [c] = await this.db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1)
    if (!c) throw new CampaignValidationError("unknown campaign")
    const [existing] = await this.db.select().from(sellerSets).where(eq(sellerSets.campaignId, campaignId)).limit(1)
    if (existing) {
      const items = await this.db.select().from(sellerSetItems).where(eq(sellerSetItems.setId, existing.id)).orderBy(asc(sellerSetItems.position))
      return { id: existing.id, name: existing.name, sellerIds: items.map((i) => i.sellerId) }
    }
    const [set] = await this.db
      .insert(sellerSets)
      .values({ id: crypto.randomUUID(), campaignId, name })
      .returning()
    if (!set) throw new Error("seller set insert failed")
    return { id: set.id, name: set.name, sellerIds: [] as string[] }
  }

  async setSellerSetItems(campaignId: string, setId: string, sellerIds: string[]) {
    const { sellers } = await import("@alkemart/db")
    const [set] = await this.db.select().from(sellerSets).where(eq(sellerSets.id, setId)).limit(1)
    if (!set || set.campaignId !== campaignId) return null
    if (sellerIds.length > 50) throw new CampaignValidationError("at most 50 sellers per set")
    if (new Set(sellerIds).size !== sellerIds.length) {
      throw new CampaignValidationError("duplicate sellers")
    }
    if (sellerIds.length > 0) {
      const found = await this.db
        .select({ id: sellers.id })
        .from(sellers)
        .where(inArray(sellers.id, sellerIds))
      const known = new Set(found.map((f) => f.id))
      for (const sid of sellerIds) {
        if (!known.has(sid)) throw new CampaignValidationError(`unknown seller: ${sid}`)
      }
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(sellerSetItems).where(eq(sellerSetItems.setId, setId))
      if (sellerIds.length > 0) {
        await tx.insert(sellerSetItems).values(
          sellerIds.map((sellerId, i) => ({ id: crypto.randomUUID(), setId, sellerId, position: i })),
        )
      }
    })
    await this.audit(campaignId, null, "sellers.set", { setId, count: sellerIds.length })
    return { id: set.id, name: set.name, sellerIds: [...sellerIds] }
  }

  async listLiveCampaigns(now: Date = new Date()): Promise<LiveCampaignDto[]> {
    const rows = await this.db.select().from(campaigns).where(eq(campaigns.status, "live"))
    const out: LiveCampaignDto[] = []
    for (const row of rows) {
      if (row.startsAt && row.startsAt.getTime() > now.getTime()) continue
      if (row.endsAt && row.endsAt.getTime() <= now.getTime()) continue
      const detail = await this.getCampaign(row.id)
      if (!detail) continue
      out.push({
        ...detail.campaign,
        creatives: detail.creatives,
        productIds: detail.productSet?.productIds ?? [],
        sellerIds: detail.sellerSet?.sellerIds ?? [],
        terms: detail.terms,
      })
    }
    return out
  }

  async sweepExpired(now: Date = new Date()): Promise<string[]> {
    const rows = await this.db.select().from(campaigns)
    const flipped: string[] = []
    for (const row of rows) {
      if (
        (row.status === "live" || row.status === "scheduled") &&
        row.endsAt &&
        row.endsAt.getTime() <= now.getTime()
      ) {
        await this.db
          .update(campaigns)
          .set({ status: "ended", updatedAt: now })
          .where(eq(campaigns.id, row.id))
        await this.audit(row.id, null, "auto-expire", { at: now.toISOString() })
        flipped.push(row.id)
      }
    }
    return flipped
  }

  async recordEvent(campaignId: string, input: {
    placementCode: string
    creativeId?: string | null
    position?: number | null
    event: "view" | "select"
  }): Promise<void> {
    try {
      const [c] = await this.db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1)
      if (!c) return
      await this.db.insert(campaignEvents).values({
        id: crypto.randomUUID(),
        campaignId,
        placementCode: input.placementCode,
        creativeId: input.creativeId ?? null,
        position: input.position ?? null,
        event: input.event,
      })
    } catch {
      /* measurement loss is acceptable; commerce must not fail */
    }
  }

  async reportCampaign(id: string) {
    const [c] = await this.db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, id)).limit(1)
    if (!c) return null
    const rows = await this.db.select().from(campaignEvents).where(eq(campaignEvents.campaignId, id))
    const views = rows.filter((e) => e.event === "view").length
    const selects = rows.filter((e) => e.event === "select").length
    const byPlacement = new Map<string, { views: number; selects: number }>()
    const byCreative = new Map<string, { views: number; selects: number }>()
    for (const e of rows) {
      const p = byPlacement.get(e.placementCode) ?? { views: 0, selects: 0 }
      p[e.event === "view" ? "views" : "selects"] += 1
      byPlacement.set(e.placementCode, p)
      const key = e.creativeId ?? "(none)"
      const cr = byCreative.get(key) ?? { views: 0, selects: 0 }
      cr[e.event === "view" ? "views" : "selects"] += 1
      byCreative.set(key, cr)
    }
    return {
      views,
      selects,
      byPlacement: [...byPlacement.entries()].map(([placementCode, v]) => ({ placementCode, ...v })),
      byCreative: [...byCreative.entries()].map(([creativeId, v]) => ({ creativeId, ...v })),
    }
  }
}
