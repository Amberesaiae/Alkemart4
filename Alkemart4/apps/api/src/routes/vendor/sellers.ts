import { createPaystackTransferRecipient, mapMomoProviderToPaystackSlug } from "@alkemart/paystack"
import { toLocalMsisdn, resolveRegionId, displayRegionName, type PaystackMomoProvider } from "@alkemart/shared/ghana"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { AuthConflictError } from "../../auth-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"
import { DELIVERY_MINUTE_BANDS, isDeliveryBand } from "@alkemart/shared/storefront-badges"

const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Paystack transferrecipient bank codes for Ghana MoMo (GET /bank). */
function momoBankCode(provider: PaystackMomoProvider): string {
  return mapMomoProviderToPaystackSlug(provider).toUpperCase()
}

const HttpUrl = z.string().trim().url().max(2048).refine(
  (v) => v.startsWith("https://") || v.startsWith("http://"),
  { message: "must be http(s)" },
)

const ProfileBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    handle: z.string().trim().min(2).max(40).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    logo: HttpUrl.optional().nullable(),
    banner: HttpUrl.optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

const AddressBody = z
  .object({
    pack_region: z.string().trim().max(80).optional().nullable(),
    digital_address: z.string().trim().max(32).optional().nullable(),
    delivery_fee_pesewas: z.string().regex(/^\d+$/).optional(),
    address_1: z.string().trim().max(200).optional().nullable(),
    address_2: z.string().trim().max(200).optional().nullable(),
    city: z.string().trim().max(120).optional().nullable(),
    district: z.string().trim().max(120).optional().nullable(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    country_code: z.string().trim().max(8).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

const PaymentBody = z.object({
  provider: z.enum(["mtn", "vodafone", "airteltigo"]),
  phone: z.string().trim().min(9).max(20),
})

const PolicyBody = z.object({
  shipping: z.string().trim().max(2000).optional(),
  returnsDays: z.number().int().min(0).max(365).optional(),
  warranty: z.string().trim().max(2000).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

const PauseBody = z.object({
  note: z.string().trim().max(500).optional().nullable(),
  until: z.string().trim().min(1).optional().nullable(),
})

const DisplayBody = z
  .object({
    categoryOrder: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
    featuredCategoryId: z.string().trim().min(1).max(64).optional().nullable(),
    stockMode: z.enum(["exact", "bands"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

const DeliveryBody = z.object({
  /** Null clears the declaration; a shop may honestly stop promising a band. */
  minutes: z
    .union([z.literal(null), z.number().int()])
    .refine((v) => v === null || isDeliveryBand(v), {
      message: `minutes must be one of ${DELIVERY_MINUTE_BANDS.join(", ")}`,
    }),
})

const ContactBody = z
  .object({
    phone: z.string().trim().max(20).optional().nullable(),
    hours: z
      .object({
        days: z.string().trim().min(1).max(40),
        open: z.string().trim().min(1).max(5),
        close: z.string().trim().min(1).max(5),
      })
      .optional()
      .nullable(),
    social: z
      .object({
        instagram: z.string().trim().max(2048).optional().nullable(),
        facebook: z.string().trim().max(2048).optional().nullable(),
        tiktok: z.string().trim().max(2048).optional().nullable(),
        whatsapp: z.string().trim().max(2048).optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

const FeaturedBody = z.object({
  productIds: z.array(z.string().trim().min(1)).max(8),
})

/** Buyer-visible copy must stay URL-free and scam-free (v1 seed list). */
const STOREFRONT_BLOCKED_PHRASES = [
  "send money",
  "momo pin",
  "mpesa pin",
  "whatsapp me",
  "counterfeit",
  "replica",
]

function containsUrl(v: string): boolean {
  return /https?:\/\//i.test(v) || /(^|\s)www\./i.test(v)
}

function containsBlockedPhrase(v: string): boolean {
  const lower = v.toLowerCase()
  return STOREFRONT_BLOCKED_PHRASES.some((p) => lower.includes(p))
}

const AnnouncementBody = z.object({
  text: z.string().trim().min(1).max(140),
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().min(1),
})

const StorefrontBody = z
  .object({
    tagline: z.string().trim().max(120).optional().nullable(),
    bio: z.string().trim().max(2000).optional().nullable(),
    announcement: AnnouncementBody.optional().nullable(),
    seoDescription: z.string().trim().max(160).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

export type StorefrontBlock = {
  tagline: string | null
  announcement: { text: string; startsAt: string; endsAt: string } | null
  announcementActive: boolean
  seoDescription: string | null
}

export function storefrontFromMetadata(meta: Record<string, unknown> | null): StorefrontBlock {  const raw = (meta?.storefront ?? null) as {
    tagline?: unknown
    announcement?: unknown
    seoDescription?: unknown
  } | null
  const tagline = typeof raw?.tagline === "string" ? raw.tagline : null
  const seoDescription = typeof raw?.seoDescription === "string" ? raw.seoDescription : null
  const a = raw?.announcement as { text?: unknown; startsAt?: unknown; endsAt?: unknown } | null | undefined
  const announcement =
    a && typeof a.text === "string" && typeof a.startsAt === "string" && typeof a.endsAt === "string"
      ? { text: a.text, startsAt: a.startsAt, endsAt: a.endsAt }
      : null
  const now = Date.now()
  const announcementActive =
    announcement != null &&
    Number.isFinite(Date.parse(announcement.startsAt)) &&
    Number.isFinite(Date.parse(announcement.endsAt)) &&
    Date.parse(announcement.startsAt) <= now &&
    now < Date.parse(announcement.endsAt)
  return { tagline, announcement, announcementActive, seoDescription }
}

export type DisplayBlock = {
  categoryOrder: string[]
  featuredCategoryId: string | null
  stockMode: "exact" | "bands"
}

export function displayFromMetadata(meta: Record<string, unknown> | null): DisplayBlock {
  const raw = (meta?.display ?? null) as {
    categoryOrder?: unknown
    featuredCategoryId?: unknown
    stockMode?: unknown
  } | null
  const categoryOrder = Array.isArray(raw?.categoryOrder)
    ? raw.categoryOrder.filter((v): v is string => typeof v === "string")
    : []
  return {
    categoryOrder,
    featuredCategoryId: typeof raw?.featuredCategoryId === "string" ? raw.featuredCategoryId : null,
    stockMode: raw?.stockMode === "bands" ? "bands" : "exact",
  }
}

export type DeliveryBlock = {
  /** One of the published bands, or null when the shop has not declared one. */
  minutes: number | null
}

/**
 * How long this shop takes, as a coarse band.
 *
 * Unset stays unset: a shop that has never declared a band shows no delivery
 * time at all rather than inheriting a platform default that nobody promised.
 */
export function deliveryFromMetadata(meta: Record<string, unknown> | null): DeliveryBlock {
  const raw = (meta?.delivery ?? null) as { minutes?: unknown } | null
  return { minutes: isDeliveryBand(raw?.minutes) ? raw.minutes : null }
}

export type ContactBlock = {
  phone: string | null
  hours: { days: string; open: string; close: string } | null
  social: { instagram?: string; facebook?: string; tiktok?: string; whatsapp?: string }
}

export function contactFromMetadata(meta: Record<string, unknown> | null): ContactBlock {
  const raw = (meta?.contact ?? null) as {
    phone?: unknown
    hours?: unknown
    social?: unknown
  } | null
  const hours = raw?.hours as { days?: unknown; open?: unknown; close?: unknown } | null | undefined
  const social = (raw?.social ?? {}) as Record<string, unknown>
  const pickSocial = (k: string) => (typeof social[k] === "string" ? (social[k] as string) : undefined)
  return {
    phone: typeof raw?.phone === "string" ? raw.phone : null,
    hours:
      hours && typeof hours.days === "string" && typeof hours.open === "string" && typeof hours.close === "string"
        ? { days: hours.days, open: hours.open, close: hours.close }
        : null,
    social: {
      ...(pickSocial("instagram") ? { instagram: pickSocial("instagram")! } : {}),
      ...(pickSocial("facebook") ? { facebook: pickSocial("facebook")! } : {}),
      ...(pickSocial("tiktok") ? { tiktok: pickSocial("tiktok")! } : {}),
      ...(pickSocial("whatsapp") ? { whatsapp: pickSocial("whatsapp")! } : {}),
    },
  }
}

const E164_RE = /^\+[1-9]\d{6,14}$/
const HOURS_DAYS_RE =
  /^(Daily|Mon|Tue|Wed|Thu|Fri|Sat|Sun)(-(Mon|Tue|Wed|Thu|Fri|Sat|Sun))?(,(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(-(Mon|Tue|Wed|Thu|Fri|Sat|Sun))?)*$/
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const SOCIAL_ALLOWLIST: Record<string, string[]> = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com"],
  tiktok: ["tiktok.com"],
  whatsapp: ["wa.me", "whatsapp.com"],
}

function socialUrlOk(kind: string, value: string): boolean {
  let host = ""
  try {
    const u = new URL(value)
    if (u.protocol !== "https:") return false
    host = u.hostname.toLowerCase()
  } catch {
    return false
  }
  return (SOCIAL_ALLOWLIST[kind] ?? []).some((d) => host === d || host.endsWith(`.${d}`))
}

function sellerIdOrThrow(c: { get: (k: "auth") => { sellerId?: string } }) {
  const sellerId = c.get("auth").sellerId
  if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
  return sellerId
}

/** Shape the vendor settings UI consumes (Medusa-style Seller). */
async function sellerView(c: Context<AppEnv>, sellerId: string) {
  const repo = c.get("authRepo")
  const seller = await repo.findSellerById(sellerId)
  if (!seller) throw new HTTPException(404, { message: "seller not found" })
  let email: string | null = null
  try {
    email = (await repo.findUserById(c.get("auth").userId))?.email ?? null
  } catch {
    email = null
  }
  const meta = seller.metadata ?? {}
  const hasAddress =
    seller.packRegion || seller.digitalAddress ||
    meta.address_1 || meta.city || meta.district
  return {
    seller: {
      id: seller.id,
      name: seller.name,
      handle: seller.handle,
      email,
      status: seller.status,
      description: seller.description,
      logo: seller.logo,
      banner: seller.banner,
      metadata: {
        ...meta,
        delivery_fee_ghs: Number((Number(seller.deliveryFeePesewas) / 100).toFixed(2)),
      },
      storefront: storefrontFromMetadata(meta),
      display: displayFromMetadata(meta),
      delivery: deliveryFromMetadata(meta),
      contact: contactFromMetadata(meta),
      address: hasAddress
        ? {
          address_1: (meta.address_1 as string | undefined) ?? null,
          address_2: (meta.address_2 as string | undefined) ?? null,
          city: (meta.city as string | undefined) ?? null,
          district: (meta.district as string | undefined) ?? null,
          latitude: (meta.latitude as number | undefined) ?? null,
          longitude: (meta.longitude as number | undefined) ?? null,
          province: displayRegionName(seller.packRegion),
          postal_code: seller.digitalAddress,
          country_code: ((meta.country_code as string | undefined) ?? "gh") as string,
        }
        : null,
      payment_details: seller.momoPhone
        ? { type: "momo", provider: seller.momoProvider, phone: seller.momoPhone }
        : null,
      availability: {
        state: seller.availability,
        pausedUntil: seller.pausedUntil ? seller.pausedUntil.toISOString() : null,
        note: seller.pauseNote,
      },
    },
  }
}

function mapSellerWriteError(err: unknown): never {
  if (err instanceof AuthConflictError) {
    throw new HTTPException(409, { message: `${err.field} already exists` })
  }
  if (err instanceof Error && err.message === "seller not found") {
    throw new HTTPException(404, { message: "seller not found" })
  }
  throw err
}

export const vendorSellers = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/me", async (c) => {
    return c.json(await sellerView(c, sellerIdOrThrow(c)))
  })
  .post("/me", async (c) => {
    const parsed = ProfileBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    const handle = parsed.data.handle?.toLowerCase()
    if (handle && !HANDLE_RE.test(handle)) {
      throw new HTTPException(400, { message: "invalid handle" })
    }
    try {
      await c.get("authRepo").updateSellerProfile(sellerId, { ...parsed.data, ...(handle ? { handle } : {}) })
    } catch (err) {
      mapSellerWriteError(err)
    }
    return c.json(await sellerView(c, sellerId))
  })
  .post("/me/address", async (c) => {
    const parsed = AddressBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    const { address_1, address_2, city, country_code, delivery_fee_pesewas, pack_region, digital_address, district, latitude, longitude } =
      parsed.data
    // Canonicalize: always store the region ID ("GH07"), never the display name.
    const packRegionId = pack_region != null ? resolveRegionId(pack_region) : undefined
    if (pack_region != null && packRegionId == null) {
      throw new HTTPException(400, { message: "unknown region" })
    }
    try {
      await c.get("authRepo").updateSellerAddress(sellerId, {
        packRegion: packRegionId ?? undefined,
        digitalAddress: digital_address ?? undefined,
        deliveryFeePesewas:
          delivery_fee_pesewas !== undefined ? BigInt(delivery_fee_pesewas) : undefined,
        metadata: {
          address_1: address_1 ?? null,
          address_2: address_2 ?? null,
          city: city ?? null,
          district: district ?? null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          country_code: country_code ?? "gh",
        },
      })
    } catch (err) {
      mapSellerWriteError(err)
    }
    return c.json(await sellerView(c, sellerId))
  })
  .post("/me/payment-details", async (c) => {
    const parsed = PaymentBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const secretKey = c.get("paystackSecretKey")
    if (!secretKey) {
      throw new HTTPException(503, { message: "PAYSTACK_SECRET_KEY is not configured" })
    }
    const sellerId = sellerIdOrThrow(c)
    const repo = c.get("authRepo")
    const seller = await repo.findSellerById(sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    // Paystack mobile_money only accepts 0-prefixed local MSISDN — never E.164.
    const localPhone = toLocalMsisdn(parsed.data.phone)
    if (!localPhone) throw new HTTPException(400, { message: "invalid MoMo number" })
    const createRecipient =
      c.get("createPaystackTransferRecipient") ?? createPaystackTransferRecipient
    let recipientCode: string
    try {
      const recipient = await createRecipient(
        { secretKey },
        {
          name: seller.name,
          accountNumber: localPhone,
          bankCode: momoBankCode(parsed.data.provider),
          currency: "GHS",
        },
      )
      recipientCode = recipient.recipientCode
    } catch (err) {
      const message = err instanceof Error ? err.message : "Paystack transfer recipient failed"
      throw new HTTPException(502, { message })
    }
    if (!recipientCode) {
      throw new HTTPException(502, { message: "Paystack did not return a recipient_code" })
    }
    try {
      await repo.updateSellerPayment(sellerId, {
        momoProvider: parsed.data.provider,
        momoPhone: localPhone,
        recipientCode,
      })
    } catch (err) {
      mapSellerWriteError(err)
    }
    return c.json(await sellerView(c, sellerId))
  })
  .patch("/me/storefront", async (c) => {
    const parsed = StorefrontBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    const { tagline, bio, announcement, seoDescription } = parsed.data

    // Server validation mirrors the client: lengths via zod above, plus
    // URL-free text, scam-signal phrases, and endsAt > startsAt.
    const checkedTexts = [
      tagline ?? undefined,
      bio ?? undefined,
      announcement?.text,
      seoDescription ?? undefined,
    ]
    for (const text of checkedTexts) {
      if (text == null || text === "") continue
      if (containsUrl(text)) throw new HTTPException(400, { message: "links are not allowed here" })
      if (containsBlockedPhrase(text)) throw new HTTPException(400, { message: "text was flagged for review" })
    }
    let announcementValue: { text: string; startsAt: string; endsAt: string } | null | undefined
    if (announcement !== undefined) {
      if (announcement === null) {
        announcementValue = null
      } else {
        const starts = Date.parse(announcement.startsAt)
        const ends = Date.parse(announcement.endsAt)
        if (!Number.isFinite(starts) || !Number.isFinite(ends)) {
          throw new HTTPException(400, { message: "invalid announcement dates" })
        }
        if (!(ends > starts)) throw new HTTPException(400, { message: "announcement endsAt must be after startsAt" })
        announcementValue = {
          text: announcement.text,
          startsAt: new Date(starts).toISOString(),
          endsAt: new Date(ends).toISOString(),
        }
      }
    }

    try {
      if (bio !== undefined) {
        await c.get("authRepo").updateSellerProfile(sellerId, { description: bio === "" ? null : bio })
      }
      const patch: Record<string, unknown> = {}
      if (tagline !== undefined) patch.tagline = tagline === "" ? null : tagline
      if (seoDescription !== undefined) patch.seoDescription = seoDescription === "" ? null : seoDescription
      if (announcementValue !== undefined) patch.announcement = announcementValue
      if (Object.keys(patch).length > 0) {
        const seller = await c.get("authRepo").findSellerById(sellerId)
        if (!seller) throw new HTTPException(404, { message: "seller not found" })
        const existing = ((seller.metadata ?? {}) as Record<string, unknown>).storefront
        const merged = { ...((existing ?? {}) as Record<string, unknown>), ...patch }
        await c.get("authRepo").patchSellerMetadata(sellerId, { storefront: merged })
      }
    } catch (err) {
      mapSellerWriteError(err)
    }
    return c.json(await sellerView(c, sellerId))
  })
  .post("/me/pause", async (c) => {
    const parsed = PauseBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    let pausedUntil: Date | null = null
    if (parsed.data.until != null && parsed.data.until !== "") {
      const t = Date.parse(parsed.data.until)
      if (!Number.isFinite(t)) throw new HTTPException(400, { message: "invalid until date" })
      if (t <= Date.now()) throw new HTTPException(400, { message: "until must be in the future" })
      pausedUntil = new Date(t)
    }
    const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null
    const seller = await c.get("authRepo").updateSellerAvailability(sellerId, {
      availability: "paused",
      pausedUntil,
      pauseNote: note,
    })
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    return c.json(await sellerView(c, sellerId))
  })
  .post("/me/unpause", async (c) => {
    const sellerId = sellerIdOrThrow(c)
    const seller = await c.get("authRepo").updateSellerAvailability(sellerId, {
      availability: "open",
      pausedUntil: null,
      pauseNote: null,
    })
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    return c.json(await sellerView(c, sellerId))
  })
  .get("/me/policies", async (c) => {
    const sellerId = sellerIdOrThrow(c)
    const [current, history] = await Promise.all([
      c.get("policies").currentPolicy(sellerId),
      c.get("policies").listPolicies(sellerId),
    ])
    const shape = (p: { id: string; version: number; body: unknown; effectiveFrom: Date }) => ({
      id: p.id,
      version: p.version,
      body: p.body,
      effectiveFrom: p.effectiveFrom.toISOString(),
    })
    return c.json({
      current: current ? shape(current) : null,
      history: history.map(shape),
    })
  })
  .post("/me/policies", async (c) => {
    const parsed = PolicyBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    const saved = await c.get("policies").savePolicy(sellerId, parsed.data)
    return c.json(
      {
        policy: {
          id: saved.id,
          version: saved.version,
          body: saved.body,
          effectiveFrom: saved.effectiveFrom.toISOString(),
        },
      },
      201,
    )
  })
  .patch("/me/display", async (c) => {
    const parsed = DisplayBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    // Category ids must exist in the shared taxonomy (admin-owned).
    const categories = await c.get("repo").listCategories().catch(() => [])
    const known = new Set<string>()
    const collect = (nodes: { id: string; children?: { id: string }[] }[]): void => {
      for (const n of nodes) {
        known.add(n.id)
        if (n.children) collect(n.children as { id: string; children?: { id: string }[] }[])
      }
    }
    collect(categories as { id: string; children?: { id: string }[] }[])
    const { categoryOrder, featuredCategoryId, stockMode } = parsed.data
    for (const id of [...(categoryOrder ?? []), ...(featuredCategoryId ? [featuredCategoryId] : [])]) {
      if (!known.has(id)) throw new HTTPException(400, { message: `unknown category: ${id}` })
    }
    const seller = await c.get("authRepo").findSellerById(sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    const existing = ((seller.metadata ?? {}) as Record<string, unknown>).display
    const merged = {
      ...((existing ?? {}) as Record<string, unknown>),
      ...(categoryOrder !== undefined ? { categoryOrder } : {}),
      ...(featuredCategoryId !== undefined ? { featuredCategoryId } : {}),
      ...(stockMode !== undefined ? { stockMode } : {}),
    }
    await c.get("authRepo").patchSellerMetadata(sellerId, { display: merged })
    return c.json(await sellerView(c, sellerId))
  })
  .patch("/me/delivery", async (c) => {
    const parsed = DeliveryBody.safeParse(await readJsonBody(c))
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: parsed.error.issues[0]?.message ?? "invalid body",
      })
    }
    const sellerId = sellerIdOrThrow(c)
    const seller = await c.get("authRepo").findSellerById(sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    await c
      .get("authRepo")
      .patchSellerMetadata(sellerId, { delivery: { minutes: parsed.data.minutes } })
    return c.json(await sellerView(c, sellerId))
  })
  .patch("/me/contact", async (c) => {
    const parsed = ContactBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    const { phone, hours, social } = parsed.data
    if (phone != null && phone !== "" && !E164_RE.test(phone)) {
      throw new HTTPException(400, { message: "phone must be E.164 (+<country><number>)" })
    }
    if (hours != null) {
      if (!HOURS_DAYS_RE.test(hours.days)) throw new HTTPException(400, { message: "invalid days range" })
      if (!HHMM_RE.test(hours.open) || !HHMM_RE.test(hours.close)) {
        throw new HTTPException(400, { message: "open/close must be HH:MM" })
      }
    }
    const socialClean: Record<string, string> = {}
    if (social != null) {
      for (const [kind, value] of Object.entries(social)) {
        if (value == null || value === "") continue
        if (!socialUrlOk(kind, value)) {
          throw new HTTPException(400, { message: `invalid ${kind} URL` })
        }
        socialClean[kind] = value
      }
    }
    const seller = await c.get("authRepo").findSellerById(sellerId)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    const existing = ((seller.metadata ?? {}) as Record<string, unknown>).contact
    const prev = ((existing ?? {}) as Record<string, unknown>).social ?? {}
    const merged = {
      ...((existing ?? {}) as Record<string, unknown>),
      ...(phone !== undefined ? { phone: phone === "" ? null : phone } : {}),
      ...(hours !== undefined ? { hours } : {}),
      ...(social !== undefined
        ? { social: { ...((prev ?? {}) as Record<string, unknown>), ...socialClean } }
        : {}),
    }
    await c.get("authRepo").patchSellerMetadata(sellerId, { contact: merged })
    return c.json(await sellerView(c, sellerId))
  })
  .get("/me/featured", async (c) => {
    const sellerId = sellerIdOrThrow(c)
    const ids = await c.get("featured").listFeatured(sellerId)
    return c.json({ productIds: ids })
  })
  .put("/me/featured", async (c) => {
    const parsed = FeaturedBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    // Only the seller's own products may be featured.
    const owned = await c.get("repo").listVendorProducts(sellerId).catch(() => [])
    const ownedIds = new Set(owned.map((p) => p.product.id))
    for (const id of parsed.data.productIds) {
      if (!ownedIds.has(id)) throw new HTTPException(400, { message: "only your own products can be featured" })
    }
    try {
      const ids = await c.get("featured").setFeatured(sellerId, parsed.data.productIds)
      return c.json({ productIds: ids })
    } catch (err) {
      throw new HTTPException(400, { message: err instanceof Error ? err.message : "invalid featured shelf" })
    }
  })
